import request from "supertest";
// import { describe, expect, it } from "vitest";
import app from "../src/app.js";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("App routes", () => {
    it("returns health text on root route", async () => {
        const response = await request(app).get("/");

        expect(response.status).toBe(200);
        expect(response.text).toBe("Auth service running");
    });

    it("returns 401 for profile without token", async () => {
        const response = await request(app).get("/profile");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Unauthorized");
    });

    it("returns 401 for profile with malformed bearer token", async () => {
        const response = await request(app)
            .get("/profile")
            .set("Authorization", "Bearer");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Unauthorized");
    });

    it("returns 401 for users endpoint without auth", async () => {
        const response = await request(app).get("/users");

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Unauthorized");
    });

    it("blocks public auth writes in read-only mode without reviving removed routes", async () => {
        vi.stubEnv("DEMO_READ_ONLY", "true");
        for (const path of ["signup", "login", "refresh", "logout"]) {
            const response = await request(app).post(`/auth/${path}`).send({});
            expect(response.status).toBe(403);
            expect(response.body.message).toBe("Public demo is read-only");
        }
        expect((await request(app).post("/auth/demo/seed-admin")).status).toBe(404);
        expect((await request(app).get("/health/live")).status).toBe(200);
        expect((await request(app).get("/openapi.json")).status).toBe(200);
    });

    it("publishes relative OpenAPI URLs and safe current contracts without seed routes", async () => {
        const response = await request(app).get("/openapi.json");
        expect(response.status).toBe(200);
        expect(response.body.servers).toEqual([{ url: "/", description: "Current API origin" }]);
        expect(response.body.paths).not.toHaveProperty("/auth/demo/seed-admin");
        for (const path of ["/me", "/auth/logout", "/health/live", "/health/ready"]) {
            expect(response.body.paths).toHaveProperty(path);
        }
        expect(Object.keys(response.body.components.schemas.User.properties).sort()).toEqual(["createdAt", "email", "id", "role"]);
        expect(response.body.components.schemas.UserPage.required).toEqual(["items", "nextCursor"]);
        const references = JSON.stringify(response.body).matchAll(/"\$ref":"#\/components\/schemas\/([^"/]+)"/g);
        for (const reference of references) {
            expect(response.body.components.schemas).toHaveProperty(reference[1]!);
        }
    });

    it("returns request-correlated 400 and 413 for invalid JSON bodies", async () => {
        const malformed = await request(app).post("/auth/signup").type("json").send("{");
        expect(malformed.status).toBe(400);
        expect(malformed.body).toEqual({ message: "Invalid JSON", requestId: malformed.headers["x-request-id"] });
        const oversized = await request(app).post("/auth/signup").send({ password: "a".repeat(11000) });
        expect(oversized.status).toBe(413);
        expect(oversized.body.requestId).toBe(oversized.headers["x-request-id"]);
    });
});

vi.mock("../src/config/redis.js", () => ({
    redis: {
        incr: vi.fn().mockRejectedValue(new Error("Unexpected Redis call in smoke test")),
        expire: vi.fn().mockRejectedValue(new Error("Unexpected Redis call in smoke test")),
    },
}));