import { Queue } from "bullmq";
import IORedis from "bullmq/node_modules/ioredis";
import { env } from "./env";

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const jobScanQueue = new Queue("job-scan", {
  connection: redisConnection,
});

export const applyQueue = new Queue("auto-apply", {
  connection: redisConnection,
});

export const resumeTailorQueue = new Queue("resume-tailor", {
  connection: redisConnection,
});
