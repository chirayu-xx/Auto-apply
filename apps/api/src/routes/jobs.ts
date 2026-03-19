import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { jobScanQueue } from "../config/queue";

const router = Router();
router.use(authMiddleware);

const jobQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  source: z.string().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  search: z.string().optional(),
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, source, minScore, search } = jobQuerySchema.parse(
      req.query
    );

    const where: Record<string, unknown> = {};
    if (source) where.source = source;
    if (minScore !== undefined) where.relevanceScore = { gte: minScore };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { scrapedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    throw err;
  }
});

// GET /api/jobs/scan-status - must come before /:id
router.get("/scan-status", async (req: AuthRequest, res: Response) => {
  const tasks = await prisma.jobScanTask.findMany({
    where: { userId: req.userId },
    orderBy: { startedAt: "desc" },
    take: 6,
  });

  // Latest batch is the most recent 3 tasks (one per source)
  const latestBatch = tasks.slice(0, 3);
  const isScanning = latestBatch.some((t) => t.status === "running" || t.status === "pending");

  const totalJobsFound = latestBatch.reduce((sum, t) => sum + t.jobsFound, 0);
  const totalJobsMatched = latestBatch.reduce((sum, t) => sum + t.jobsMatched, 0);

  res.json({
    isScanning,
    tasks: latestBatch.map((t) => ({
      id: t.id,
      source: t.source,
      status: t.status,
      jobsFound: t.jobsFound,
      jobsMatched: t.jobsMatched,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
    })),
    summary: {
      totalJobsFound,
      totalJobsMatched,
    },
  });
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  const job = await prisma.job.findUnique({ where: { id: req.params["id"] as string } });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.post("/scan", async (req: AuthRequest, res: Response) => {
  const sources = ["linkedin", "indeed", "naukri"];

  const tasks = await Promise.all(
    sources.map((source) =>
      jobScanQueue.add("scan", {
        userId: req.userId,
        source,
      })
    )
  );

  res.json({
    message: "Job scan triggered",
    taskIds: tasks.map((t) => t.id),
  });
});

export default router;
