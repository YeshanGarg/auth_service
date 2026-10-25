import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

const directNeonFixture = "postgresql://fixture:fixture-secret@ep-fixture.example.neon.tech/neondb?sslmode=require";
const pooledNeonFixture = directNeonFixture.replace("ep-fixture.", "ep-fixture-pooler.");

it.each([
    { label: "reviewed manual main run", override: {}, valid: true },
    { label: "pull request", override: { GITHUB_EVENT_NAME: "pull_request" }, valid: false },
    { label: "other branch", override: { GITHUB_REF: "refs/heads/unreviewed" }, valid: false },
    { label: "other repository", override: { GITHUB_REPOSITORY: "other/repo" }, valid: false },
    { label: "other target", override: { NEON_MIGRATION_DATABASE_URL: directNeonFixture }, valid: false },
    { label: "weak runtime password", override: { NEON_RUNTIME_PASSWORD: "short" }, valid: false },
])("guards the cloud release against $label", ({ override, valid }) => {
    const script = fileURLToPath(new URL("../scripts/neon-release.mjs", import.meta.url));
    const url = "postgresql://fixture:fixture-secret@ep-withered-pine-b3hlkd2b.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    const result = spawnSync(process.execPath, [script, "--check"], {
        env: {
            ...process.env, GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch",
            GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "YeshanGarg/auth_service",
            NEON_MIGRATION_DATABASE_URL: url, NEON_RUNTIME_PASSWORD: "a".repeat(96), ...override,
        },
        encoding: "utf8",
    });
    expect(result.status).toBe(valid ? 0 : 1);
    if (valid) expect(result.stdout).toContain("Release guards passed; no connection attempted");
    expect(result.stdout + result.stderr).not.toContain("fixture-secret");
    expect(result.stdout + result.stderr).not.toContain("a".repeat(96));
});

it.each([
    { label: "pooled runtime", mode: "start", url: pooledNeonFixture, valid: true },
    { label: "direct migration", mode: "migrate", url: directNeonFixture, valid: true },
    { label: "pooled migration", mode: "migrate", url: pooledNeonFixture, valid: false },
    { label: "different endpoint", mode: "migrate", url: directNeonFixture.replace("ep-fixture.", "ep-other."), valid: false },
    { label: "different database", mode: "start", url: pooledNeonFixture.replace("/neondb?", "/other?"), valid: false },
    { label: "non-Postgres URL", mode: "start", url: pooledNeonFixture.replace("postgresql:", "https:"), valid: false },
])("checks Neon $label without connecting or rewriting configuration", ({ mode, url, valid }) => {
    const directory = mkdtempSync(join(tmpdir(), "auth-neon-"));
    const files = {
        ".env": "DATABASE_URL=postgresql://local:local@localhost/local\nJWT_SECRET=fixture-secret\n",
        ".env.neon": `DATABASE_URL=${mode === "start" ? url : pooledNeonFixture}\nDATABASE_URL_UNPOOLED=${directNeonFixture}\n`,
        ".env.deploy": `DATABASE_URL=${mode === "migrate" ? url : directNeonFixture}\n`,
    };
    try {
        for (const [name, content] of Object.entries(files)) writeFileSync(join(directory, name), content);
        const script = fileURLToPath(new URL("../scripts/neon.mjs", import.meta.url));
        const result = spawnSync(process.execPath, [script, mode, "--check"], {
            cwd: directory, encoding: "utf8",
        });
        expect(result.status).toBe(valid ? 0 : 1);
        if (valid) expect(result.stdout).toContain("TLS verification enforced; no connection attempted");
        expect(result.stdout + result.stderr).not.toContain("fixture-secret");
        for (const [name, content] of Object.entries(files)) {
            expect(readFileSync(join(directory, name), "utf8")).toBe(content);
        }
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});