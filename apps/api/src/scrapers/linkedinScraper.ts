import { BaseScraper, ScrapedJob, ScraperConfig } from "./baseScraper";
import * as cheerio from "cheerio";

export class LinkedInScraper extends BaseScraper {
  source = "linkedin";

  // LinkedIn guest job search API
  private readonly BASE_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";

  async scrape(config: ScraperConfig): Promise<ScrapedJob[]> {
    const roles = config.roles.length ? config.roles : ["Software Engineer"];
    const locations = config.remoteOnly
      ? ["Remote"]
      : config.locations.length
        ? config.locations
        : ["India"];

    const allJobs: ScrapedJob[] = [];

    for (const role of roles) {
      for (const location of locations) {
        try {
          console.log(`[LinkedInScraper] Searching: "${role}" in "${location}"`);
          const jobs = await this.searchJobs(role, location, config.remoteOnly);
          allJobs.push(...jobs);
          await this.randomDelay(2000, 4000);
        } catch (err) {
          console.error(`[LinkedInScraper] Error searching "${role}" in "${location}":`, err instanceof Error ? err.message : err);
        }
      }
    }

    const seen = new Set<string>();
    const unique = allJobs.filter((j) => {
      if (seen.has(j.sourceUrl)) return false;
      seen.add(j.sourceUrl);
      return true;
    });

    console.log(`[LinkedInScraper] Found ${unique.length} unique jobs`);
    return unique;
  }

  private async searchJobs(keyword: string, location: string, remoteOnly: boolean): Promise<ScrapedJob[]> {
    const params: Record<string, string> = {
      keywords: keyword,
      location: location,
      start: "0",
      sortBy: "DD", // Most recent
    };

    if (remoteOnly) {
      params["f_WT"] = "2"; // Remote filter
    }

    try {
      const response = await this.httpClient.get(this.BASE_URL, {
        params,
        headers: {
          "User-Agent": this.getRandomUserAgent(),
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
        },
      });

      const $ = cheerio.load(response.data);
      const jobs: ScrapedJob[] = [];

      $("li").each((_i, el) => {
        const $el = $(el);
        const $card = $el.find("div.base-card, div.job-search-card");

        if ($card.length === 0) return;

        const title = this.cleanText($card.find("h3.base-search-card__title, .base-search-card__title").text());
        const company = this.cleanText($card.find("h4.base-search-card__subtitle a, .base-search-card__subtitle a").first().text())
          || this.cleanText($card.find("h4.base-search-card__subtitle, .base-search-card__subtitle").text());
        const loc = this.cleanText($card.find("span.job-search-card__location").text());
        const link = $card.find("a.base-card__full-link").attr("href")
          || $card.find("a[href*='linkedin.com/jobs']").attr("href")
          || "";
        const listDate = $card.find("time").attr("datetime") || "";
        const salarySnippet = this.cleanText($card.find(".job-search-card__salary-info").text());

        if (title && company && link) {
          // Normalize the URL (remove tracking params)
          const sourceUrl = link.split("?")[0] || link;

          jobs.push({
            title,
            company,
            location: loc || location,
            jobType: "full-time",
            source: this.source,
            sourceUrl,
            description: `${company} is hiring a ${title} in ${loc || location}.`,
            salaryRange: salarySnippet || null,
            experienceLevel: this.inferExperienceLevel(title),
            isEasyApply: false,
            postedAt: listDate ? new Date(listDate) : new Date(),
            requiredSkills: [],
          });
        }
      });

      // Try to enrich descriptions for first few jobs
      const enrichLimit = Math.min(jobs.length, 5);
      for (let i = 0; i < enrichLimit; i++) {
        try {
          await this.randomDelay(800, 1500);
          const enriched = await this.enrichJobDetails(jobs[i]!);
          jobs[i] = enriched;
        } catch {
          // Skip enrichment failures silently
        }
      }

      return jobs;
    } catch (err) {
      console.error(`[LinkedInScraper] Search failed:`, err instanceof Error ? err.message : err);
      return [];
    }
  }

  private async enrichJobDetails(job: ScrapedJob): Promise<ScrapedJob> {
    try {
      const response = await this.httpClient.get(job.sourceUrl, {
        headers: {
          "User-Agent": this.getRandomUserAgent(),
          "Accept": "text/html",
        },
      });

      const $ = cheerio.load(response.data);

      const description = this.cleanText(
        $("div.description__text, div.show-more-less-html__markup").text()
      );

      const criteriaItems: string[] = [];
      $("li.description__job-criteria-item").each((_i, el) => {
        const label = $(el).find("h3").text().trim();
        const value = $(el).find("span").text().trim();
        if (label && value) criteriaItems.push(`${label}: ${value}`);
      });

      // Extract skills from description
      const skills = this.extractSkillsFromText(description);

      return {
        ...job,
        description: description || job.description,
        requiredSkills: skills,
        experienceLevel: this.inferExperienceLevel(description || job.title),
      };
    } catch {
      return job;
    }
  }
}
