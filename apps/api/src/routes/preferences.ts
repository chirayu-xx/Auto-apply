import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

const preferencesSchema = z.object({
  targetRoles: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  remoteOnly: z.boolean().optional(),
  minSalary: z.number().optional(),
  autoApplyThreshold: z.number().min(0).max(100).optional(),
  blacklistedCompanies: z.array(z.string()).optional(),
  blacklistedKeywords: z.array(z.string()).optional(),
  scanFrequency: z.enum(["6h", "12h", "24h"]).optional(),
  isPaused: z.boolean().optional(),
});

router.get("/", async (req: AuthRequest, res: Response) => {
  const prefs = await prisma.jobPreference.findUnique({
    where: { userId: req.userId! },
  });
  if (!prefs) {
    res.json(null);
    return;
  }
  res.json(prefs);
});

router.put("/", async (req: AuthRequest, res: Response) => {
  try {
    const data = preferencesSchema.parse(req.body);
    const prefs = await prisma.jobPreference.upsert({
      where: { userId: req.userId! },
      update: data,
      create: { userId: req.userId!, ...data },
    });
    res.json(prefs);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    throw err;
  }
});

export default router;
