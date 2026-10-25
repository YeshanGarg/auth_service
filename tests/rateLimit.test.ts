import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { rateLimit } from "../src/middlewares/rateLimit.middleware.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";

const { evalMock } = vi.hoisted(() => ({ evalMock: vi.fn() }));
vi.mock("../src/config/redis.js", () => ({
    redis: { eval: evalMock },
}));
vi.mock("../src/utils/logger.js", () => ({
    logger: { error: vi.fn() },
}));

beforeEach(() => { evalMock.mockReset(); });

const app = express();
app.post("/limited", rateLimit({ windowSeconds: 60, maxRequests: 3 }),
    (_req, res) => { res.status(204).end(); });
app.use(errorHandler);

it.each([
    [[1, 60], 204, undefined],
    [[3, 42], 204, undefined],
    [[4, 42], 429, "42"],
    [[4, 0], 429, "1"],
    [null, 503, undefined],
    [[1, -1], 503, undefined],
] as const)("maps Redis result %j to %s", async (result, status, retryAfter) => {
    evalMock.mockResolvedValue(result);

    const response = await request(app).post("/limited");

    expect(response.status).toBe(status);
    expect(response.headers["retry-after"]).toBe(retryAfter);
    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(evalMock).toHaveBeenCalledWith(
        expect.any(String), 1, expect.stringMatching(/^rate:.*:\/limited$/), 60
    );
});

it("fails closed without exposing Redis error details", async () => {
    evalMock.mockRejectedValue(new Error("private-redis-details"));

    const response = await request(app).post("/limited");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: "Rate limiting unavailable" });
    expect(response.text).not.toContain("private-redis-details");
});