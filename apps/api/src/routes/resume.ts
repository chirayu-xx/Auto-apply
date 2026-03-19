import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import prisma from "../config/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { env } from "../config/env";

const router = Router();
router.use(authMiddleware);

// Ensure upload directory exists
const uploadDir = path.resolve(env.UPLOAD_DIR, "resumes");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req: AuthRequest, _file, cb) => {
    const ext = ".pdf";
    cb(null, `${req.userId}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

const resumeContentSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experience: z.array(
    z.object({
      company: z.string().optional(),
      role: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      bullets: z.array(z.string()).optional(),
    })
  ).optional(),
  education: z.array(
    z.object({
      institution: z.string().optional(),
      degree: z.string().optional(),
      field: z.string().optional(),
      graduationDate: z.string().optional(),
    })
  ).optional(),
  projects: z.array(
    z.object({
      name: z.string().optional(),
      techStack: z.array(z.string()).optional(),
      bullets: z.array(z.string()).optional(),
    })
  ).optional(),
});

router.post(
  "/upload",
  upload.single("resume"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const filePath = req.file.path;

    // Call AI service to parse resume
    try {
      const formData = new FormData();
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: "application/pdf" });
      formData.append("file", blob, req.file.originalname);

      const aiResponse = await fetch(`${env.AI_SERVICE_URL}/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (!aiResponse.ok) {
        throw new Error(`AI service error: ${aiResponse.statusText}`);
      }

      const parsedContent = await aiResponse.json();

      // Upsert resume (one per user for MVP)
      const resume = await prisma.resume.upsert({
        where: { userId: req.userId! },
        update: {
          originalPdfUrl: filePath,
          parsedContent,
          skills: parsedContent.skills || [],
        },
        create: {
          userId: req.userId!,
          originalPdfUrl: filePath,
          parsedContent,
          skills: parsedContent.skills || [],
        },
      });

      res.status(201).json(resume);
    } catch (error) {
      console.error("Resume parsing error:", error);
      // Still save the resume even if parsing fails
      const resume = await prisma.resume.upsert({
        where: { userId: req.userId! },
        update: {
          originalPdfUrl: filePath,
          parsedContent: {},
          skills: [],
        },
        create: {
          userId: req.userId!,
          originalPdfUrl: filePath,
          parsedContent: {},
          skills: [],
        },
      });
      res
        .status(201)
        .json({ ...resume, warning: "Resume saved but parsing failed" });
    }
  }
);

router.get("/parsed", async (req: AuthRequest, res: Response) => {
  const resume = await prisma.resume.findUnique({
    where: { userId: req.userId! },
  });
  if (!resume) {
    res.status(404).json({ error: "No resume uploaded" });
    return;
  }
  res.json(resume);
});

router.put("/parsed", async (req: AuthRequest, res: Response) => {
  try {
    const parsedContent = resumeContentSchema.parse(req.body);
    const existingResume = await prisma.resume.findUnique({
      where: { userId: req.userId! },
    });

    if (!existingResume) {
      res.status(404).json({ error: "No resume uploaded" });
      return;
    }

    const resume = await prisma.resume.update({
      where: { userId: req.userId! },
      data: {
        parsedContent,
        skills: parsedContent.skills || [],
      },
    });

    res.json(resume);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    throw err;
  }
});

export default router;
