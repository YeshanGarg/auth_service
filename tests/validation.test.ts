import { afterEach, expect, it, vi } from "vitest";
import { signupSchema, LoginSchema, refreshSchema, listUsersQuerySchema } from "../src/utils/validators.js";
import { logger } from "../src/utils/logger.js";

const { redisConstructor } = vi.hoisted(() => ({ redisConstructor: vi.fn() }));
vi.mock("ioredis", () => ({
    Redis: class {
        constructor(...args: unknown[]) { redisConstructor(...args); }
        on = vi.fn();
    },
}));
afterEach(() => vi.unstubAllEnvs());

it.each(["redis://private-render-host:6379", "rediss://default:fixture-only@secure-host:6379"])("uses Redis URL without overriding its host: %s", async (url) => {
    vi.resetModules();
    redisConstructor.mockClear();
    vi.stubEnv("REDIS_URL", url);
    vi.stubEnv("REDIS_HOST", "must-not-override-url");
    await import("../src/config/redis.js");
    expect(redisConstructor).toHaveBeenCalledWith(url, expect.objectContaining({ lazyConnect: true }));
    expect(redisConstructor.mock.calls[0]?.[1]).not.toHaveProperty("host");
    expect(redisConstructor.mock.calls[0]?.[1]).not.toHaveProperty("port");
});

it("retains host/port settings for local Redis", async () => {
    vi.resetModules();
    redisConstructor.mockClear();
    vi.stubEnv("REDIS_URL", undefined);
    vi.stubEnv("REDIS_HOST", "local-redis");
    vi.stubEnv("REDIS_PORT", "6380");
    await import("../src/config/redis.js");
    expect(redisConstructor).toHaveBeenCalledWith(expect.objectContaining({ host: "local-redis", port: 6380 }));
});

it.each([signupSchema, LoginSchema])("enforces bcrypt byte bounds", (schema) => {
    expect(schema.safeParse({ email: "user@example.com", password: "a".repeat(72) }).success).toBe(true);
    expect(schema.safeParse({ email: "user@example.com", password: "a".repeat(73) }).success).toBe(false);
    expect(schema.safeParse({ email: "user@example.com", password: "\u00e9".repeat(37) }).success).toBe(false);
});
it("rejects oversized refresh values and invalid pagination", () => {
    expect(refreshSchema.safeParse({ refreshToken: "a".repeat(513) }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({ cursor: "2147483648" }).success).toBe(false);
    expect(listUsersQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(listUsersQuerySchema.parse({})).toEqual({ limit: 10 });
});
it("redacts nested credentials and personal data in structured metadata", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
        logger.info("Test event", { requestId: "safe-id", nested: { password: "private", refreshToken: "private", email: "private" } });
        const message = JSON.parse(String(output.mock.calls[0]?.[0]));
        expect(message.meta.requestId).toBe("safe-id");
        expect(message.meta.nested).toEqual({ password: "[REDACTED]", refreshToken: "[REDACTED]", email: "[REDACTED]" });
    } finally {
        output.mockRestore();
    }
});