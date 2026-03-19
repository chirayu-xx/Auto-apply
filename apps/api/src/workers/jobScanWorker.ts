import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/queue";
import prisma from "../config/db";
import { getScraper } from "../scrapers";
import { env } from "../config/env";
import type { ScrapedJob } from "../scrapers/baseScraper";

interface JobScanData {
  userId: string;
  source: string;
}

interface EffectivePreferences {
  targetRoles: string[];
  targetLocations: string[];
  remoteOnly: boolean;
  autoApplyThreshold: number;
  blacklistedCompanies: string[];
  blacklistedKeywords: string[];
  isPaused: boolean;
}

const jobScanWorker = new Worker<JobScanData>(
  "job-scan",
  async (job: Job<JobScanData>) => {
    const { userId, source } = job.data;
    console.log(`[JobScan] Starting scan for user=${userId} source=${source}`);

    // Get user preferences
    const preferences = await prisma.jobPreference.findUnique({
      where: { userId },
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new Error("User not found");
    }

    const effectivePreferences: EffectivePreferences = {
      targetRoles: preferences?.targetRoles ?? user.desiredRoles ?? [],
      targetLocations: preferences?.targetLocations ?? (user.location ? [user.location] : []),
      remoteOnly:
        preferences?.remoteOnly ?? user.workPreference === "remote",
      autoApplyThreshold: preferences?.autoApplyThreshold ?? 75,
      blacklistedCompanies: preferences?.blacklistedCompanies ?? [],
      blacklistedKeywords: preferences?.blacklistedKeywords ?? [],
      isPaused: preferences?.isPaused ?? false,
    };

    if (effectivePreferences.isPaused) {
      console.log("[JobScan] Automation is paused, skipping");
      return { jobsFound: 0, jobsMatched: 0 };
    }

    // Create scan task record
    const scanTask = await prisma.jobScanTask.create({
      data: {
        userId,
        source,
        status: "running",
        startedAt: new Date(),
      },
    });

    const scraper = getScraper(source);
    if (!scraper) {
      throw new Error(`Unknown scraper source: ${source}`);
    }

    try {
      const scrapedJobs: ScrapedJob[] = await scraper.scrape({
        roles: effectivePreferences.targetRoles,
        locations: effectivePreferences.targetLocations,
        remoteOnly: effectivePreferences.remoteOnly,
      });

      let jobsFound = 0;
      let jobsMatched = 0;

      for (const scraped of scrapedJobs) {
        // Skip blacklisted companies
        if (
          effectivePreferences.blacklistedCompanies.some(
            (c) => c.toLowerCase() === scraped.company.toLowerCase()
          )
        ) {
          continue;
        }

        if (
          effectivePreferences.blacklistedKeywords.some((keyword) => {
            const normalizedKeyword = keyword.toLowerCase();
            return (
              scraped.title.toLowerCase().includes(normalizedKeyword) ||
              scraped.description.toLowerCase().includes(normalizedKeyword)
            );
          })
        ) {
          continue;
        }

        // Deduplicate by sourceUrl
        const existing = await prisma.job.findUnique({
          where: { sourceUrl: scraped.sourceUrl },
        });
        if (existing) continue;

        // Score the job against the user's resume
        const resume = await prisma.resume.findUnique({ where: { userId } });
        let relevanceScore = 0;

        if (resume && resume.parsedContent) {
          try {
            const scoreRes = await fetch(`${env.AI_SERVICE_URL}/score-match`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                resume: resume.parsedContent,
                jobDescription: scraped.description,
              }),
            });
            if (scoreRes.ok) {
              const scoreData = await scoreRes.json();
              relevanceScore = scoreData.score || 0;
            } else {
              const errorText = await scoreRes.text();
              console.error("[JobScan] Scoring service error:", errorText);
            }
          } catch (err) {
            console.error("[JobScan] Scoring failed:", err);
          }
        }

        // Store the job
        const { requiredSkills, ...scrapedRest } = scraped;
        await prisma.job.create({
          data: {
            ...scrapedRest,
            requiredSkills: requiredSkills || [],
            relevanceScore,
          },
        });

        jobsFound++;
        if (relevanceScore >= effectivePreferences.autoApplyThreshold) {
          jobsMatched++;
        }
      }

      // Update scan task
      await prisma.jobScanTask.update({
        where: { id: scanTask.id },
        data: {
          status: "completed",
          jobsFound,
          jobsMatched,
          completedAt: new Date(),
        },
      });

      console.log(
        `[JobScan] Completed: found=${jobsFound}, matched=${jobsMatched}`
      );
      return { jobsFound, jobsMatched };
    } catch (error) {
      await prisma.jobScanTask.update({
        where: { id: scanTask.id },
        data: { status: "failed", completedAt: new Date() },
      });
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 3 }
);

jobScanWorker.on("failed", (job, err) => {
  console.error(`[JobScan] Job ${job?.id} failed:`, err.message);
});

export default jobScanWorker;
