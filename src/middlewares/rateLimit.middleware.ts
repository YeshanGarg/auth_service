import type { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis.js";
import { AppError } from "../utils/AppError.js";

interface RateLimitOptions{
    windowSeconds: number,
    maxRequests: number
}

// export const rateLimit =
//     ({ windowSeconds, maxRequests}: RateLimitOptions) =>
//     async (req: Request, res: Response, next: NextFunction) => {
//         const ip = req.ip;
//         const key = `rate:${ip}:${req.path}`;

//         const current = await redis.incr(key);

//         if (current === 1) {
//             await redis.expire(key, windowSeconds);
//         }

//         if (current > maxRequests) {
//             throw new AppError("Too many requests, try again later",429);
//         }

//         next();
//     }


const rateLimitScript = `
local current = redis.call("INCR", KEYS[1])
local ttl = redis.call("TTL", KEYS[1])
if ttl < 0 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return {current, ttl}
`;

export const rateLimit =
    ({ windowSeconds, maxRequests }: RateLimitOptions) =>
    async (req: Request, res: Response, next: NextFunction) => {
        const key = `rate:${req.ip}:${req.baseUrl}${req.path}`;
        let result: unknown;
        try {
            result = await redis.eval(rateLimitScript, 1, key, windowSeconds);
        } catch {
            return next(new AppError("Rate limiting unavailable", 503));
        }

        if (!Array.isArray(result) || result.length !== 2 ||
            !Number.isInteger(result[0]) || !Number.isInteger(result[1]) ||
            result[0] < 1 || result[1] < 0) {
            return next(new AppError("Rate limiting unavailable", 503));
        }

        const current = Number(result[0]);
        const ttl = Math.max(1, Number(result[1]));
        if (current > maxRequests) {
            res.setHeader("Retry-After", String(ttl));
            return next(new AppError("Too many requests, try again later", 429));
        }

        return next();
    };