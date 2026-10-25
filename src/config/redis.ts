import "dotenv/config";
import { Redis } from "ioredis";
import { logger } from "../utils/logger.js";

const options = {
    connectTimeout: 3000,
    commandTimeout: 3000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy: (attempt: number) => attempt > 5 ? null : Math.min(attempt * 200, 1500),
};

export const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, options)
    : new Redis({
        ...options,
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
    });

redis.on("error", () => {
    logger.error("Redis connection unavailable", {});
});