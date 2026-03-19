import axios, { AxiosInstance } from "axios";
import { chromium, Browser, BrowserContext } from "playwright-core";
import * as path from "path";

export interface ScrapedJob {
  title: string;
  company: string;
  location: string | null;
  jobType: string | null;
  source: string;
  sourceUrl: string;
  description: string;
  salaryRange: string | null;
  experienceLevel: string | null;
  isEasyApply: boolean;
  postedAt: Date | null;
  requiredSkills: string[];
}

export interface ScraperConfig {
  roles: string[];
  locations: string[];
  remoteOnly: boolean;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

// Chrome executable discovery for playwright-core
function findChromePath(): string {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.env["PROGRAMFILES"] || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env["LOCALAPPDATA"] || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env["PROGRAMFILES"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
      ]
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];

  const fs = require("fs");
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Chrome/Chromium not found. Install Chrome for browser-based scraping.");
}

// Shared browser instance (lazy singleton)
let _browserPromise: Promise<Browser> | null = null;

export function getBrowser(): Promise<Browser> {
  if (!_browserPromise) {
    _browserPromise = chromium.launch({
      executablePath: findChromePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    }).catch((err) => {
      _browserPromise = null;
      throw err;
    });
  }
  return _browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (_browserPromise) {
    const browser = await _browserPromise;
    _browserPromise = null;
    await browser.close();
  }
}

export abstract class BaseScraper {
  abstract source: string;
  abstract scrape(config: ScraperConfig): Promise<ScrapedJob[]>;

  protected httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
      },
    });
  }

  protected async createBrowserContext(): Promise<BrowserContext> {
    const browser = await getBrowser();
    return browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1366, height: 768 },
      locale: "en-IN",
    });
  }

  protected getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return this.delay(ms);
  }

  protected cleanText(text: string | null | undefined): string {
    if (!text) return "";
    return text.replace(/\s+/g, " ").trim();
  }

  protected inferExperienceLevel(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("intern") || lower.includes("trainee")) return "intern";
    if (lower.includes("fresher") || lower.includes("entry") || lower.includes("junior") || lower.includes("0-2") || lower.includes("0-1")) return "entry";
    if (lower.includes("senior") || lower.includes("lead") || lower.includes("sr.") || lower.includes("5+") || lower.includes("7+")) return "senior";
    if (lower.includes("principal") || lower.includes("staff") || lower.includes("architect") || lower.includes("10+")) return "principal";
    if (lower.includes("manager") || lower.includes("director") || lower.includes("head") || lower.includes("vp")) return "manager";
    return "mid";
  }

  protected extractSkillsFromText(text: string): string[] {
    const knownSkills = [
      "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin",
      "React", "Angular", "Vue", "Next.js", "Node.js", "Express", "Django", "Flask", "Spring", "Rails",
      "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Jenkins", "CI/CD",
      "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB", "Cassandra",
      "REST", "GraphQL", "gRPC", "Microservices",
      "Git", "Linux", "Agile", "Machine Learning", "AI", "Deep Learning",
      "HTML", "CSS", "Tailwind", "SQL", "NoSQL", "System Design",
    ];
    const upperText = text.toUpperCase();
    return knownSkills.filter((s) => upperText.includes(s.toUpperCase())).slice(0, 10);
  }
}
