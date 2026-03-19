import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/queue";
import prisma from "../config/db";
import { env } from "../config/env";

interface ApplyData {
  applicationId: string;
  userId: string;
  jobId: string;
}

const applyWorker = new Worker<ApplyData>(
  "auto-apply",
  async (job: Job<ApplyData>) => {
    const { applicationId, userId, jobId } = job.data;
    console.log(
      `[AutoApply] Processing application=${applicationId} job=${jobId}`
    );

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!application) {
      throw new Error("Application not found");
    }

    const resume = await prisma.resume.findUnique({ where: { userId } });
    if (!resume) {
      throw new Error("No resume found for user");
    }

    try {
      // Step 1: Tailor resume for this job
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: "tailoring" },
      });

      const tailorRes = await fetch(`${env.AI_SERVICE_URL}/tailor-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: resume.parsedContent,
          jobDescription: application.job.description,
        }),
      });

      if (!tailorRes.ok) {
        throw new Error(`Tailoring failed: ${tailorRes.statusText}`);
      }

      const tailoredContent = await tailorRes.json();

      const tailoredResume = await prisma.tailoredResume.create({
        data: {
          resumeId: resume.id,
          jobId,
          tailoredContent,
          matchScore: tailoredContent.matchScore || 0,
          highlightedSkills: tailoredContent.highlightedSkills || [],
        },
      });

      // Step 2: Auto-apply via Playwright
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "applying",
          tailoredResumeId: tailoredResume.id,
        },
      });

      // TODO: Implement Playwright-based application submission
      // based on application.job.source (linkedin, indeed, naukri)
      // For now, mark as applied (placeholder)
      console.log(
        `[AutoApply] Would apply to ${application.job.source}: ${application.job.sourceUrl}`
      );

      // Step 3: Mark as applied
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "applied",
          appliedAt: new Date(),
        },
      });

      console.log(`[AutoApply] Successfully applied to ${application.job.title}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "failed",
          errorLog: errorMessage,
        },
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // One at a time to avoid detection
    limiter: {
      max: 5,
      duration: 60000, // Max 5 applications per minute
    },
  }
);

applyWorker.on("failed", (job, err) => {
  console.error(`[AutoApply] Job ${job?.id} failed:`, err.message);
});

export default applyWorker;
