import { BaseScraper, ScrapedJob, ScraperConfig } from "./baseScraper";

export class IndeedScraper extends BaseScraper {
  source = "indeed";

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
          console.log(`[IndeedScraper] Searching: "${role}" in "${location}"`);
          const jobs = await this.searchWithBrowser(role, location, config.remoteOnly);
          allJobs.push(...jobs);
          await this.randomDelay(2000, 4000);
        } catch (err) {
          console.error(`[IndeedScraper] Error searching "${role}" in "${location}":`, err instanceof Error ? err.message : err);
        }
      }
    }

    const seen = new Set<string>();
    const unique = allJobs.filter((j) => {
      if (seen.has(j.sourceUrl)) return false;
      seen.add(j.sourceUrl);
      return true;
    });

    console.log(`[IndeedScraper] Found ${unique.length} unique jobs`);
    return unique;
  }

  private async searchWithBrowser(keyword: string, location: string, remoteOnly: boolean): Promise<ScrapedJob[]> {
    const params = new URLSearchParams({
      q: keyword,
      l: location,
      sort: "date",
    });
    if (remoteOnly) params.set("remotejob", "032b3046-06a3-4876-8dfd-474eb5e7ed11");

    const url = `https://in.indeed.com/jobs?${params.toString()}`;

    let context;
    try {
      context = await this.createBrowserContext();
      const page = await context.newPage();

      console.log(`[IndeedScraper] Browser navigating to: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Wait for job cards to appear
      await page.waitForSelector("div.job_seen_beacon, div.cardOutline, div.result, div[data-jk]", { timeout: 15000 }).catch(() => {
        console.log("[IndeedScraper] Job cards not found with primary selectors");
      });

      // Extra wait for dynamic content
      await this.delay(2000);

      const jobs = await page.evaluate(() => {
        const results: Array<{
          title: string; company: string; location: string;
          link: string; jobId: string; snippet: string;
          salary: string; date: string; isEasyApply: boolean;
        }> = [];

        const cards = document.querySelectorAll(
          "div.job_seen_beacon, div.cardOutline, div.result, td.resultContent"
        );

        cards.forEach((card) => {
          const titleEl = card.querySelector("h2.jobTitle span[title], h2.jobTitle a, a.jcs-JobTitle span, a.jcs-JobTitle");
          const companyEl = card.querySelector("span[data-testid='company-name'], span.css-92r8pb, span.companyName, [data-testid='company-name']");
          const locationEl = card.querySelector("div[data-testid='text-location'], div.companyLocation, div.css-1p0sjhy, [data-testid='text-location']");
          const snippetEl = card.querySelector("div.css-9446fg, div.heading6, ul[style] li, td.snip .summary, [class*='job-snippet']");
          const salaryEl = card.querySelector("div[data-testid='attribute_snippet_testid'], div.salary-snippet-container, .metadata .salaryText, [class*='salary']");
          const dateEl = card.querySelector("span.css-qvloho, span.date, span[class*='Date'], [class*='date']");
          const linkEl = card.querySelector("a[data-jk], a.jcs-JobTitle, h2.jobTitle a");

          const title = titleEl?.textContent?.trim() || "";
          const company = companyEl?.textContent?.trim() || "";
          const link = (linkEl as HTMLAnchorElement)?.href || "";
          const jobId = linkEl?.getAttribute("data-jk") || "";

          if (title && company) {
            results.push({
              title,
              company,
              location: locationEl?.textContent?.trim() || "",
              link,
              jobId,
              snippet: snippetEl?.textContent?.trim() || "",
              salary: salaryEl?.textContent?.trim() || "",
              date: dateEl?.textContent?.trim() || "",
              isEasyApply: !!card.querySelector(".iaLabel, .ialbl, [data-testid='indeedApply']"),
            });
          }
        });

        return results;
      });

      console.log(`[IndeedScraper] Browser extracted ${jobs.length} jobs`);
      return jobs.map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location || location,
        jobType: this.detectJobType(j.snippet + " " + j.title),
        source: this.source,
        sourceUrl: j.link.startsWith("http")
          ? j.link
          : j.jobId
            ? `https://in.indeed.com/viewjob?jk=${encodeURIComponent(j.jobId)}`
            : `https://in.indeed.com${j.link}`,
        description: j.snippet || `${j.company} is hiring for ${j.title} in ${j.location || location}.`,
        salaryRange: j.salary || null,
        experienceLevel: this.inferExperienceLevel(j.title + " " + j.snippet),
        isEasyApply: j.isEasyApply,
        postedAt: this.parseRelativeDate(j.date),
        requiredSkills: this.extractSkillsFromText(j.snippet + " " + j.title),
      } as ScrapedJob));
    } catch (err) {
      console.error(`[IndeedScraper] Browser scrape failed:`, err instanceof Error ? err.message : err);
      return [];
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  private detectJobType(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("part-time") || lower.includes("part time")) return "part-time";
    if (lower.includes("contract")) return "contract";
    if (lower.includes("freelance")) return "freelance";
    if (lower.includes("internship") || lower.includes("intern")) return "internship";
    return "full-time";
  }

  private parseRelativeDate(text: string): Date {
    const now = new Date();
    const lower = text.toLowerCase();
    const daysMatch = lower.match(/(\d+)\s*day/);
    if (daysMatch) {
      now.setDate(now.getDate() - parseInt(daysMatch[1]!, 10));
      return now;
    }
    if (lower.includes("just posted") || lower.includes("today")) return now;
    return now;
  }
}
