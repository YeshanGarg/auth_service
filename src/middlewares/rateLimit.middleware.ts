import type { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.js";
import { AppError } from "../utils/AppError.js";

interface RateLimitOptions{
    windowSeconds: number,
    maxRequests: number
}

export const rateLimit = 
    ({ windowSeconds, maxRequests}: RateLimitOptions) => 
    async (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip;
        const key = `rate:${ip}:${req.path}`;

        const current = await redis.incr(key);

        if (current === 1) {
            await redis.expire(key, windowSeconds);
        }

        if (current > maxRequests) {
            throw new AppError("Too many requests, try again later",429);
        }

        next();
    }