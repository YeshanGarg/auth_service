import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { errorHandler } from "../src/middlewares/error.middleware.js";

it.skipIf(process.env.RUN_REDIS_INTEGRATION !== "true")(
    "limits concurrent requests, repairs expiry, and recovers after expiration",
    async () => {
        const { redis } = await import("../src/config/redis.js");
        let key: string | undefined;
        try {
            const { rateLimit } =
                await import("../src/middlewares/rateLimit.middleware.js");
            const app = express();
            const path = `/rate-test-${randomUUID()}`;
            app.post(path, (req, _res, next) => {
                key = `rate:${req.ip}:${req.baseUrl}${req.path}`;
                next();
            }, rateLimit({ windowSeconds: 60, maxRequests: 3 }),
            (_req, res) => { res.status(204).end(); });
            app.use(errorHandler);

            const responses = await Promise.all(
                Array.from({ length: 8 }, () => request(app).post(path))
            );
            expect(responses.filter((response) => response.status === 204))
                .toHaveLength(3);
            expect(responses.filter((response) => response.status === 429))
                .toHaveLength(5);
            if (!key) throw new Error("Expected a captured rate-limit key");

            expect(await redis.get(key)).toBe("8");
            expect(await redis.ttl(key)).toBeGreaterThan(0);
            expect(await redis.ttl(key)).toBeLessThanOrEqual(60);

            await redis.persist(key);
            expect(await redis.ttl(key)).toBe(-1);
            expect((await request(app).post(path)).status).toBe(429);
            expect(await redis.ttl(key)).toBeGreaterThan(0);

            await redis.pexpire(key, 0);
            expect((await request(app).post(path)).status).toBe(204);
            expect(await redis.get(key)).toBe("1");
        } finally {
            try {
                if (key) await redis.del(key);
            } finally {
                redis.disconnect();
            }
        }
    },
    15000
);