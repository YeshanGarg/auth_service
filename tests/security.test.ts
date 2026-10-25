import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { Prisma } from "../src/generated/prisma/client.js";
import { AppError } from "../src/utils/AppError.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import { getUsers } from "../src/services/user.service.js";

const { findManyMock } = vi.hoisted(() => ({
    findManyMock: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({
    prisma: { user: { findMany: findManyMock } },
}));

vi.mock("../src/utils/logger.js", () => ({
    logger: { error: vi.fn() },
}));

beforeEach(() => { findManyMock.mockReset(); });

it.each([
    [
        new ZodError([{ code: "custom", path: ["email"], message: "Invalid email" }]),
        400,
        { message: "Invalid request", issues: [{ path: "email", message: "Invalid email" }] },
    ],
    [
        new Prisma.PrismaClientKnownRequestError("internal-secret", {
            code: "P2002", clientVersion: "7.8.0",
        }),
        409,
        { message: "Duplicate field value" },
    ],
    [new AppError("Forbidden", 403), 403, { message: "Forbidden" }],
    [new Error("internal-secret"), 500, { message: "Internal server error" }],
] as const)("maps %s to HTTP %s", async (error, status, body) => {
    const app = express();
    app.get("/", () => { throw error; });
    app.use(errorHandler);

    const response = await request(app).get("/");

    expect(response.status).toBe(status);
    expect(response.body).toEqual(body);
    expect(response.text).not.toContain("internal-secret");
});

it("requests only explicitly permitted user fields", async () => {
    findManyMock.mockResolvedValue([]);
    await getUsers({ limit: 10 });

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
        select: { id: true, email: true, role: true, createdAt: true },
        where: { deletedAt: null },
    }));
});

it.each([
    [[], [], null],
    [[3, 2], [3, 2], null],
    [[3, 2, 1], [3, 2], 2],
] as const)("paginates IDs %j", async (ids, expectedIds, nextCursor) => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    findManyMock.mockResolvedValue(ids.map((id) => ({
        id, email: `${id}@example.com`, role: "USER", createdAt,
    })));

    const page = await getUsers({ limit: 2 });

    expect(page.items.map((user) => user.id)).toEqual(expectedIds);
    expect(page.nextCursor).toBe(nextCursor);
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
        take: 3,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
});

it("skips the cursor row on subsequent pages", async () => {
    findManyMock.mockResolvedValue([]);
    await getUsers({ limit: 2, cursor: 3 });
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
        cursor: { id: 3 }, skip: 1, take: 3,
    }));
});