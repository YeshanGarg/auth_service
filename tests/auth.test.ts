import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authenticate } from "../src/middlewares/auth.middleware.js";
import { authorize } from "../src/middlewares/role.middleware.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from "../src/utils/token.js";

const { findFirstMock } = vi.hoisted(() => ({ findFirstMock: vi.fn() }));
vi.mock("../src/config/prisma.js", () => ({
    prisma: { user: { findFirst: findFirstMock } },
}));
vi.mock("../src/utils/logger.js", () => ({ logger: { error: vi.fn() } }));

beforeEach(() => {
    findFirstMock.mockReset();
    vi.stubEnv("JWT_SECRET", "test-only-secret-not-for-deployment");
});
afterEach(() => { vi.unstubAllEnvs(); });

const app = express();
app.get("/admin", authenticate, authorize(["ADMIN"]), (_req, res) => {
    res.json({ message: "Allowed" });
});
app.use(errorHandler);

it.each([
    ["ADMIN", 200],
    ["USER", 403],
    [null, 401],
] as const)("uses current account role %s → %s", async (role, status) => {
    findFirstMock.mockResolvedValue(role ? { id: 1, role } : null);
    const token = generateAccessToken({ userId: 1, role: "ADMIN" });
    const response = await request(app).get("/admin")
        .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(status);
    expect(findFirstMock).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        select: { id: true, role: true },
    });
});

it("returns sanitized 500 when the account lookup fails", async () => {
    findFirstMock.mockRejectedValue(new Error("private-database-details"));
    const token = generateAccessToken({ userId: 1, role: "ADMIN" });
    const response = await request(app).get("/admin")
        .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Internal server error" });
});

it.each([
    { issuer: "wrong" },
    { audience: "wrong" },
    { algorithm: "HS384" },
    { expiresIn: -1 },
] as const)("rejects invalid token options %j", async (overrides) => {
    const token = jwt.sign({ userId: 1, role: "ADMIN" },
        "test-only-secret-not-for-deployment", {
            algorithm: "HS256", issuer: "auth-service",
            audience: "auth-service-api", expiresIn: "15m", ...overrides,
        });
    const response = await request(app).get("/admin")
        .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
});

it("generates URL-safe refresh tokens from 32 random bytes", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
});

it("computes the expected SHA-256 digest", () => {
    expect(hashRefreshToken("abc")).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
});

it("hashes consistently without returning the raw token", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
    expect(hashRefreshToken(token)).not.toBe(hashRefreshToken(token + "x"));
});

it.each([
    { userId: 0, role: "ADMIN" },
    { userId: -1, role: "ADMIN" },
    { userId: "1", role: "ADMIN" },
    { userId: 1, role: "UNKNOWN" },
    { userId: 1 },
])("rejects malformed signed claims %j before a database lookup", async (payload) => {
    const token = generateAccessToken(payload);
    const response = await request(app).get("/admin").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
});

it.each(["wrong-signature", "missing-expiry"])("rejects %s tokens", async (scenario) => {
    const token = jwt.sign({ userId: 1, role: "ADMIN" },
        scenario === "wrong-signature" ? "different-test-secret" : "test-only-secret-not-for-deployment", {
            algorithm: "HS256", issuer: "auth-service", audience: "auth-service-api",
            ...(scenario === "wrong-signature" ? { expiresIn: 900 } : {}),
        });
    expect((await request(app).get("/admin").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
});

it("treats missing signing configuration as a server failure", async () => {
    const token = generateAccessToken({ userId: 1, role: "ADMIN" });
    vi.stubEnv("JWT_SECRET", undefined);
    expect((await request(app).get("/admin").set("Authorization", `Bearer ${token}`)).status).toBe(500);
    expect(findFirstMock).not.toHaveBeenCalled();
});