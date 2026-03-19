import { LinkedInScraper } from "./linkedinScraper";
import { IndeedScraper } from "./indeedScraper";
import { NaukriScraper } from "./naukriScraper";
import { BaseScraper, closeBrowser } from "./baseScraper";

const scrapers: Record<string, BaseScraper> = {
  linkedin: new LinkedInScraper(),
  indeed: new IndeedScraper(),
  naukri: new NaukriScraper(),
};

export function getScraper(source: string): BaseScraper | undefined {
  return scrapers[source];
}

export { BaseScraper, LinkedInScraper, IndeedScraper, NaukriScraper, closeBrowser };
export type { ScrapedJob, ScraperConfig } from "./baseScraper";
