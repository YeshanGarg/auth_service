import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import healthRoutes from "../src/routes/health.routes.js";
import { validateEnvironment } from "../src/config/env.js";

const { queryMock, pingMock } = vi.hoisted(() => ({ queryMock: vi.fn(), pingMock: vi.fn() }));
vi.mock("../src/config/prisma.js", () => ({ prisma: { $queryRaw: queryMock } }));
vi.mock("../src/config/redis.js", () => ({ redis: { ping: pingMock } }));
beforeEach(() => {
    queryMock.mockReset().mockResolvedValue([{ value: 1 }]);
    pingMock.mockReset().mockResolvedValue("PONG");
});
const app = express();
app.use("/health", healthRoutes);

it("answers liveness without touching dependencies", async () => {
    expect((await request(app).get("/health/live")).status).toBe(200);
    expect(queryMock).not.toHaveBeenCalled();
    expect(pingMock).not.toHaveBeenCalled();
});
it("reports ready when dependencies respond", async () => {
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
});
it.each(["database", "redis"])("sanitizes %s readiness failures", async (dependency) => {
    (dependency === "database" ? queryMock : pingMock).mockRejectedValue(new Error("private-connection-details"));
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "not_ready" });
    expect(response.headers["cache-control"]).toBe("no-store");
});
it("validates configuration without returning secret values in errors", () => {
    expect(() => validateEnvironment({ DATABASE_URL: "private-value", JWT_SECRET: "private-secret" }))
        .toThrow("Invalid configuration: DATABASE_URL, JWT_SECRET");
});