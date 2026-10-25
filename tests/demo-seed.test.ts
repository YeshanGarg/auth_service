import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// const { seedDemoAdminMock } = vi.hoisted(() => ({
//     seedDemoAdminMock: vi.fn(),
// }));

// vi.mock("../src/services/auth.service.js", async () => {
//     const actual = await vi.importActual<typeof import("../src/services/auth.service.js")>("../src/services/auth.service.js");
//     return {
//         ...actual,
//         seedDemoAdmin: seedDemoAdminMock,
//     };
// });

import app from "../src/app.js";

// const originalNodeEnv = process.env.NODE_ENV;
// const originalDemoMode = process.env.DEMO_MODE;
// const originalEnableDemoRoutes = process.env.ENABLE_DEMO_ROUTES;

// describe("Demo seed endpoint", () => {
//     beforeEach(() => {
//         // seedDemoAdminMock.mockReset();
//         process.env.NODE_ENV = originalNodeEnv;
//         if (originalDemoMode === undefined) {
//             delete process.env.DEMO_MODE;
//         } else {
//             process.env.DEMO_MODE = originalDemoMode;
//         }
//         if (originalEnableDemoRoutes === undefined) {
//             delete process.env.ENABLE_DEMO_ROUTES;
//         } else {
//             process.env.ENABLE_DEMO_ROUTES = originalEnableDemoRoutes;
//         }
//     });

//     afterAll(() => {
//         process.env.NODE_ENV = originalNodeEnv;
//         if (originalDemoMode === undefined) {
//             delete process.env.DEMO_MODE;
//         } else {
//             process.env.DEMO_MODE = originalDemoMode;
//         }
//         if (originalEnableDemoRoutes === undefined) {
//             delete process.env.ENABLE_DEMO_ROUTES;
//         } else {
//             process.env.ENABLE_DEMO_ROUTES = originalEnableDemoRoutes;
//         }
//     });

//     it("returns 404 when demo route is disabled in production", async () => {
//         process.env.NODE_ENV = "production";
//         delete process.env.DEMO_MODE;
//         delete process.env.ENABLE_DEMO_ROUTES;

//         const response = await request(app).post("/auth/demo/seed-admin");

//         expect(response.status).toBe(404);
//         expect(response.body.message).toBe("Not found");
//         // expect(seedDemoAdminMock).not.toHaveBeenCalled();
//     });

//     it("returns seeded credentials when demo route is explicitly enabled", async () => {
//         process.env.NODE_ENV = "production";
//         process.env.DEMO_MODE = "true";

//         // seedDemoAdminMock.mockResolvedValue({
//         //     email: "admin.demo@example.com",
//         //     password: "DemoAdmin123!",
//         //     role: "ADMIN",
//         // });

//         const response = await request(app).post("/auth/demo/seed-admin");

//         expect(response.status).toBe(201);
//         expect(response.body).toEqual({
//             email: "admin.demo@example.com",
//             password: "DemoAdmin123!",
//             role: "ADMIN",
//         });
//         // expect(seedDemoAdminMock).toHaveBeenCalledTimes(1);
//     });
// });

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("Removed admin seed endpoint", () => {
    it.each([
        ["false", "false"],
        ["true", "false"],
        ["false", "true"],
        ["true", "true"],
    ])("returns 404 with demo flags %s/%s", async (demoMode, enableDemoRoutes) => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DEMO_MODE", demoMode);
        vi.stubEnv("ENABLE_DEMO_ROUTES", enableDemoRoutes);

        const response = await request(app).post("/auth/demo/seed-admin");

        expect(response.status).toBe(404);
    });
});

vi.mock("../src/config/redis.js", () => ({
    redis: {
        incr: vi.fn().mockRejectedValue(new Error("Unexpected Redis call in smoke test")),
        expire: vi.fn().mockRejectedValue(new Error("Unexpected Redis call in smoke test")),
    },
}));