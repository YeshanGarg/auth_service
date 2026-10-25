import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { signup, login, refreshAccessToken, logout } from "../src/services/auth.service.js";
import { hashRefreshToken } from "../src/utils/token.js";
import { getUsers } from "../src/services/user.service.js";

it.skipIf(process.env.RUN_SESSION_INTEGRATION !== "true")(
    "stores digests and permits only one refresh-token consumer",
    async () => {
        let userId: number | undefined;
        try {
            const email = `session-${randomUUID()}@example.com`;
            const password = `Test-${randomUUID()}`;
            const user = await signup({ email, password });
            userId = user.id;
            const session = await login({ email, password });

            const stored = await prisma.refreshToken.findUniqueOrThrow({
                where: { tokenHash: hashRefreshToken(session.refreshToken) },
            });
            expect(stored.tokenHash).not.toBe(session.refreshToken);
            expect(stored.tokenHash).toBe(hashRefreshToken(session.refreshToken));

            const rotated = await refreshAccessToken(session.refreshToken);
            expect(rotated.refreshToken).not.toBe(session.refreshToken);
            await expect(refreshAccessToken(session.refreshToken))
                .rejects.toMatchObject({ statusCode: 401 });

            const results = await Promise.allSettled([
                refreshAccessToken(rotated.refreshToken),
                refreshAccessToken(rotated.refreshToken),
            ]);
            expect(results.filter((result) => result.status === "fulfilled"))
                .toHaveLength(1);
            const rejected = results.filter((result) => result.status === "rejected");
            expect(rejected).toHaveLength(1);
            expect(rejected[0]?.reason).toMatchObject({ statusCode: 401 });
            expect(await prisma.refreshToken.count({ where: { userId } })).toBe(1);
            const winner = results.find((result) => result.status === "fulfilled");
            if (!winner || winner.status !== "fulfilled") {
                throw new Error("Expected one successful refresh");
            }
            const activeToken = winner.value.refreshToken;
            const otherSession = await login({ email, password });

            await logout(activeToken);
            await logout(activeToken);

            await expect(refreshAccessToken(activeToken))
                .rejects.toMatchObject({ statusCode: 401 });
            await expect(refreshAccessToken(otherSession.refreshToken))
                .resolves.toHaveProperty("refreshToken");
            expect(await prisma.refreshToken.count({ where: { userId } })).toBe(1);
            const events = await prisma.auditLog.findMany({ where: { actorId: userId } });
            expect(events.map((event) => event.action)).toEqual(expect.arrayContaining([
                "USER_SIGNUP", "USER_LOGIN", "REFRESH_TOKEN_CREATED", "REFRESH_TOKEN_ROTATED", "SESSION_LOGOUT",
            ]));
            const serializedEvents = JSON.stringify(events);
            expect(serializedEvents).not.toContain(password);
            expect(serializedEvents).not.toContain(session.refreshToken);
            expect(serializedEvents).not.toContain(activeToken);
        } finally {
            try {
                if (userId !== undefined) {
                    await prisma.$transaction([
                        prisma.auditLog.deleteMany({ where: { actorId: userId } }),
                        prisma.user.deleteMany({ where: { id: userId } }),
                    ]);
                }
            } finally {
                await prisma.$disconnect();
            }
        }
    },
    20000
);

it.skipIf(process.env.RUN_SESSION_INTEGRATION !== "true")(
    "paginates tied timestamps without duplicates, extra records, or secrets",
    async () => {
        const prefix = `pagination-${randomUUID()}-`;
        try {
            await prisma.user.createMany({ data: Array.from({ length: 6 }, (_, index) => ({
                email: `${prefix}${index}@example.com`,
                password: "synthetic-non-login-record",
                createdAt: new Date("2020-01-01T00:00:00Z"),
                deletedAt: index === 5 ? new Date() : null,
            })) });
            const fixtures = await prisma.user.findMany({
                where: { email: { startsWith: prefix }, deletedAt: null }, orderBy: { id: "desc" },
            });
            const seen: number[] = [];
            let cursor: number | null = null;
            let finished = false;
            for (let pageNumber = 0; pageNumber < 1000; pageNumber++) {
                const page = await getUsers({ limit: 2, ...(cursor === null ? {} : { cursor }) });
                expect(page.items.length).toBeLessThanOrEqual(2);
                for (const user of page.items) {
                    expect(Object.keys(user).sort()).toEqual(["createdAt", "email", "id", "role"]);
                    seen.push(user.id);
                }
                cursor = page.nextCursor;
                if (cursor === null) { finished = true; break; }
            }
            expect(finished).toBe(true);
            expect(new Set(seen).size).toBe(seen.length);
            expect(seen.filter((id) => fixtures.some((user) => user.id === id))).toEqual(fixtures.map((user) => user.id));
            const deleted = await prisma.user.findFirstOrThrow({ where: { email: `${prefix}5@example.com` } });
            expect(seen).not.toContain(deleted.id);
        } finally {
            await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
            await prisma.$disconnect();
        }
    },
    20000
);

it.skipIf(process.env.RUN_SESSION_INTEGRATION !== "true")(
    "runs safe HTTP signup, authorization, rotation and logout with real stores",
    async () => {
        const { default: api } = await import("../src/app.js");
        const { redis } = await import("../src/config/redis.js");
        const harness = express();
        const prefix = `/integration-${randomUUID()}`;
        harness.use(prefix, api);
        const email = `http-${randomUUID()}@example.com`;
        const password = `Test-${randomUUID()}`;
        let userId: number | undefined;
        try {
            expect((await request(harness).get(`${prefix}/health/live`)).status).toBe(200);
            expect((await request(harness).get(`${prefix}/health/ready`)).status).toBe(200);
            const created = await request(harness).post(`${prefix}/auth/signup`).send({ email, password });
            expect(created.status).toBe(201);
            const createdId: unknown = created.body.id;
            if (typeof createdId !== "number" || !Number.isSafeInteger(createdId)) {
                throw new Error("Signup did not return a valid user ID");
            }
            userId = createdId;
            expect(Object.keys(created.body).sort()).toEqual(["email", "id"]);
            const storedUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
            expect(storedUser.password).not.toBe(password);
            expect(storedUser.password).toMatch(/^\$2[aby]\$/);
            const signupAudit = await prisma.auditLog.findFirstOrThrow({ where: { actorId: userId, action: "USER_SIGNUP" } });
            expect(signupAudit.metadata).toEqual({ requestId: created.headers["x-request-id"] });
            expect((await request(harness).post(`${prefix}/auth/signup`).send({ email, password })).status).toBe(409);
            const invalid = await request(harness).post(`${prefix}/auth/signup`).send({ email: "invalid", password: "short" });
            expect(invalid.status).toBe(400);
            expect(invalid.body.requestId).toBe(invalid.headers["x-request-id"]);
            const wrongPassword = await request(harness).post(`${prefix}/auth/login`).send({ email, password: "wrong-password" });
            const unknownEmail = await request(harness).post(`${prefix}/auth/login`).send({ email: `unknown-${email}`, password });
            expect(wrongPassword.status).toBe(401);
            expect(unknownEmail.status).toBe(401);
            expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
            const loggedIn = await request(harness).post(`${prefix}/auth/login`).send({ email, password });
            expect(loggedIn.status).toBe(200);
            const authorization = `Bearer ${loggedIn.body.accessToken}`;
            expect((await request(harness).get(`${prefix}/me`)).status).toBe(401);
            const profile = await request(harness).get(`${prefix}/me`).set("Authorization", authorization);
            expect(profile.status).toBe(200);
            expect(Object.keys(profile.body).sort()).toEqual(["createdAt", "email", "id", "role"]);
            expect((await request(harness).get(`${prefix}/users`).set("Authorization", authorization)).status).toBe(403);
            expect((await request(harness).get(`${prefix}/admin/dashboard`).set("Authorization", authorization)).status).toBe(403);
            await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
            const listed = await request(harness).get(`${prefix}/users?limit=2`).set("Authorization", authorization);
            expect(listed.status).toBe(200);
            expect(Array.isArray(listed.body.items)).toBe(true);
            for (const user of listed.body.items) expect(Object.keys(user).sort()).toEqual(["createdAt", "email", "id", "role"]);
            expect((await request(harness).get(`${prefix}/admin/dashboard`).set("Authorization", authorization)).status).toBe(200);
            const adminSession = await login({ email, password });
            await prisma.user.update({ where: { id: userId }, data: { role: "USER" } });
            expect((await request(harness).get(`${prefix}/admin/dashboard`).set("Authorization", `Bearer ${adminSession.accessToken}`)).status).toBe(403);
            const rotated = await request(harness).post(`${prefix}/auth/refresh`).send({ refreshToken: loggedIn.body.refreshToken });
            expect(rotated.status).toBe(200);
            expect((await request(harness).post(`${prefix}/auth/refresh`).send({ refreshToken: loggedIn.body.refreshToken })).status).toBe(401);
            for (let attempt = 0; attempt < 2; attempt++) {
                const loggedOut = await request(harness).post(`${prefix}/auth/logout`).send({ refreshToken: rotated.body.refreshToken });
                expect(loggedOut.status).toBe(204);
                expect(loggedOut.text).toBe("");
            }
            expect((await request(harness).post(`${prefix}/auth/refresh`).send({ refreshToken: rotated.body.refreshToken })).status).toBe(401);
            await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
            expect((await request(harness).get(`${prefix}/me`).set("Authorization", authorization)).status).toBe(401);
            expect((await request(harness).post(`${prefix}/auth/login`).send({ email, password })).status).toBe(401);
            expect((await request(harness).post(`${prefix}/auth/refresh`).send({ refreshToken: adminSession.refreshToken })).status).toBe(401);
            expect((await request(harness).post(`${prefix}/auth/demo/seed-admin`)).status).toBe(404);
        } finally {
            try {
                if (userId !== undefined) {
                    await prisma.$transaction([
                        prisma.auditLog.deleteMany({ where: { actorId: userId } }),
                        prisma.user.deleteMany({ where: { id: userId } }),
                    ]);
                }
                let cursor = "0";
                do {
                    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `rate:*:${prefix}/*`, "COUNT", 100);
                    cursor = nextCursor;
                    if (keys.length) await redis.del(...keys);
                } while (cursor !== "0");
            } finally {
                redis.disconnect();
                await prisma.$disconnect();
            }
        }
    },
    30000
);