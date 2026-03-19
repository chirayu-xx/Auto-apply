import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../config/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  desiredRoles: z.array(z.string()).optional(),
  experienceLevel: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  workPreference: z.enum(["remote", "onsite", "hybrid"]).optional(),
});

router.get("/profile", async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      resume: true,
      jobPreference: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { passwordHash, ...profile } = user;
  res.json(profile);
});

router.put("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        location: true,
        desiredRoles: true,
        experienceLevel: true,
        salaryMin: true,
        salaryMax: true,
        workPreference: true,
      },
    });
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    throw err;
  }
});

export default router;
