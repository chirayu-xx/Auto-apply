import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

export const env = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // AI Service
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8000",

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

  // Storage
  UPLOAD_DIR: process.env.UPLOAD_DIR || "./uploads",
};
