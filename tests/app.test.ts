import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

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
});
