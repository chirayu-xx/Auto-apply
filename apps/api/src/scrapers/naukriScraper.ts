import { BaseScraper, ScrapedJob, ScraperConfig } from "./baseScraper";

export class NaukriScraper extends BaseScraper {
  source = "naukri";

  async scrape(config: ScraperConfig): Promise<ScrapedJob[]> {
    const roles = config.roles.length ? config.roles : ["Software Engineer"];
    const locations = config.remoteOnly
      ? ["work from home"]
      : config.locations.length
        ? config.locations
        : [];

    const allJobs: ScrapedJob[] = [];

    for (const role of roles) {
      const locs = locations.length > 0 ? locations : [""];
      for (const location of locs) {
        try {
          console.log(`[NaukriScraper] Searching: "${role}"${location ? ` in "${location}"` : ''}`);
          const jobs = await this.searchWithBrowser(role, location);
          allJobs.push(...jobs);
          await this.randomDelay(1500, 3000);
        } catch (err) {
          console.error(`[NaukriScraper] Error searching "${role}":`, err instanceof Error ? err.message : err);
        }
      }
    }

    const seen = new Set<string>();
    const unique = allJobs.filter((j) => {
      if (seen.has(j.sourceUrl)) return false;
      seen.add(j.sourceUrl);
      return true;
    });

    console.log(`[NaukriScraper] Found ${unique.length} unique jobs`);
    return unique;
  }

  private async searchWithBrowser(keyword: string, location: string): Promise<ScrapedJob[]> {
    const urlKeyword = keyword.toLowerCase().replace(/\s+/g, "-");
    const urlLocation = location ? location.toLowerCase().replace(/\s+/g, "-") : "";
    const path = location ? `${urlKeyword}-jobs-in-${urlLocation}` : `${urlKeyword}-jobs`;
    const url = `https://www.naukri.com/${path}`;

    let context;
    try {
      context = await this.createBrowserContext();
      const page = await context.newPage();

      // Intercept Naukri API calls to capture job data directly
      let apiJobData: any = null;
      page.on("response", async (response) => {
        const responseUrl = response.url();
        if (responseUrl.includes("jobapi/v3/search") || responseUrl.includes("jobapi/v4/search")) {
          try {
            const json = await response.json();
            if (json?.jobDetails?.length) {
              apiJobData = json;
            }
          } catch { /* not JSON */ }
        }
      });

      console.log(`[NaukriScraper] Browser navigating to: ${url}`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

      // Wait for job cards to render
      await page.waitForSelector("div[class*='srp-jobtuple'], article[class*='jobTuple'], div[class*='cust-job-tuple']", { timeout: 10000 }).catch(() => {
        console.log("[NaukriScraper] Job cards selector not found, trying alternative...");
      });

      // If we intercepted API data, use that (most reliable)
      if (apiJobData?.jobDetails?.length) {
        console.log(`[NaukriScraper] Got ${apiJobData.jobDetails.length} jobs from intercepted API`);
        return apiJobData.jobDetails
          .filter((job: any) => job.title && job.companyName)
          .map((job: any) => this.mapApiJob(job, location));
      }

      // Fallback: Extract from rendered DOM
      const jobs = await page.evaluate(() => {
        const results: Array<{
          title: string; company: string; location: string;
          link: string; skills: string; salary: string;
          experience: string; description: string;
        }> = [];

        const cards = document.querySelectorAll(
          "div[class*='srp-jobtuple'], article[class*='jobTuple'], div[class*='cust-job-tuple'], div[class*='jobTuple']"
        );

        cards.forEach((card) => {
          const titleEl = card.querySelector("a[class*='title'], .title, .desig, a.title");
          const companyEl = card.querySelector("a[class*='comp-name'], .comp-name, .companyInfo a, a.subTitle");
          const locationEl = card.querySelector("span[class*='loc'], .locWdth, .location");
          const skillsEl = card.querySelector("ul[class*='tags'], .tag-li, .tags-gt");
          const salaryEl = card.querySelector("span[class*='sal'], .salwdth, .salary");
          const expEl = card.querySelector("span[class*='exp'], .expwdth, .experience");
          const descEl = card.querySelector(".job-desc, .job-description, .ellipsis");

          const title = titleEl?.textContent?.trim() || "";
          const company = companyEl?.textContent?.trim() || "";
          const link = (titleEl as HTMLAnchorElement)?.href || (companyEl as HTMLAnchorElement)?.closest("a")?.href || "";

          if (title && company) {
            results.push({
              title,
              company,
              location: locationEl?.textContent?.trim() || "",
              link,
              skills: skillsEl?.textContent?.trim() || "",
              salary: salaryEl?.textContent?.trim() || "",
              experience: expEl?.textContent?.trim() || "",
              description: descEl?.textContent?.trim() || "",
            });
          }
        });

        return results;
      });

      console.log(`[NaukriScraper] DOM extracted ${jobs.length} jobs`);
      return jobs.map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location || location || "India",
        jobType: "full-time" as const,
        source: this.source,
        sourceUrl: j.link.startsWith("http") ? j.link : `https://www.naukri.com${j.link}`,
        description: j.description || `${j.company} is hiring for ${j.title}. ${j.skills}`.trim(),
        salaryRange: j.salary || null,
        experienceLevel: this.inferExperienceLevel(j.experience || j.title),
        isEasyApply: false,
        postedAt: new Date(),
        requiredSkills: j.skills ? j.skills.split(/[,|]/).map((s) => s.trim()).filter(Boolean).slice(0, 10) : this.extractSkillsFromText(j.description + " " + j.title),
      } as ScrapedJob));
    } catch (err) {
      console.error(`[NaukriScraper] Browser scrape failed:`, err instanceof Error ? err.message : err);
      return [];
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  private mapApiJob(job: any, fallbackLocation: string): ScrapedJob {
    const jdURL = job.jdURL || job.staticUrl || "";
    const sourceUrl = jdURL.startsWith("http") ? jdURL : `https://www.naukri.com${jdURL || `/job-listings-${job.jobId || "unknown"}`}`;

    const skills = job.tagsAndSkills
      ? job.tagsAndSkills.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

    const location = job.placeholders?.find((p: any) => p.type === "location")?.label || null;
    const experience = job.placeholders?.find((p: any) => p.type === "experience")?.label || "";
    const salary = job.placeholders?.find((p: any) => p.type === "salary")?.label || job.salary || null;

    return {
      title: job.title || "Unknown Position",
      company: job.companyName || "Unknown Company",
      location: location || fallbackLocation || "India",
      jobType: "full-time",
      source: this.source,
      sourceUrl,
      description: this.cleanText(job.jobDescription) || `${job.companyName} is hiring for ${job.title}. Skills: ${skills.join(", ")}`,
      salaryRange: salary,
      experienceLevel: experience ? this.inferExperienceLevel(experience) : "mid",
      isEasyApply: false,
      postedAt: job.createdDate ? new Date(job.createdDate) : new Date(),
      requiredSkills: skills.slice(0, 10),
    };
  }
}
