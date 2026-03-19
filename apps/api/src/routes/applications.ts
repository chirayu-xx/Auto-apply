import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { applyQueue } from "../config/queue";

const router = Router();
router.use(authMiddleware);

const applicationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, status } = applicationQuerySchema.parse(req.query);

    const where: Record<string, unknown> = { userId: req.userId };
    if (status) where.status = status;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          job: {
            select: {
              title: true,
              company: true,
              location: true,
              source: true,
              sourceUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      applications,
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

router.post("/:jobId/apply", async (req: AuthRequest, res: Response) => {
  const jobId = req.params["jobId"] as string;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId: req.userId!, jobId } },
  });
  if (existing) {
    res.status(409).json({ error: "Already applied to this job" });
    return;
  }

  const application = await prisma.application.create({
    data: {
      userId: req.userId!,
      jobId,
      status: "queued",
    },
  });

  await applyQueue.add("apply", {
    applicationId: application.id,
    userId: req.userId,
    jobId,
  });

  res.status(201).json(application);
});

router.get("/stats", async (req: AuthRequest, res: Response) => {
  const [total, byStatus] = await Promise.all([
    prisma.application.count({ where: { userId: req.userId } }),
    prisma.application.groupBy({
      by: ["status"],
      where: { userId: req.userId },
      _count: true,
    }),
  ]);

  res.json({
    total,
    byStatus: byStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  });
});

export default router;
