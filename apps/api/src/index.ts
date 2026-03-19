import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import jobRoutes from "./routes/jobs";
import applicationRoutes from "./routes/applications";
import resumeRoutes from "./routes/resume";
import preferencesRoutes from "./routes/preferences";
import "./workers/jobScanWorker";
import "./workers/applyWorker";

const app = express();

// Security & parsing
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/preferences", preferencesRoutes);

// Error handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`[API] Server running on http://localhost:${env.PORT}`);
  console.log("[API] BullMQ workers initialized");
});

export default app;
