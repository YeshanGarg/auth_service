import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const expectedHost = "ep-withered-pine-b3hlkd2b.c-4.ap-southeast-1.aws.neon.tech";
let owner;
let runtime;
let server;
let serverExit;
let fixtureEmail;

try {
    assert.equal(process.env.GITHUB_ACTIONS, "true");
    assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch");
    assert.equal(process.env.GITHUB_REF, "refs/heads/main");
    assert.equal(process.env.GITHUB_REPOSITORY, "YeshanGarg/auth_service");
    assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--check"));
    const migrationUrl = new URL(process.env.NEON_MIGRATION_DATABASE_URL);
    assert.ok(["postgres:", "postgresql:"].includes(migrationUrl.protocol));
    assert.equal(migrationUrl.hostname, expectedHost);
    assert.equal(migrationUrl.port || "5432", "5432");
    assert.equal(migrationUrl.pathname, "/neondb");
    assert.match(process.env.NEON_RUNTIME_PASSWORD ?? "", /^[a-f0-9]{96}$/);
    migrationUrl.searchParams.set("sslmode", "verify-full");

    if (process.argv[2] === "--check") {
        console.log("Release guards passed; no connection attempted and no credentials printed");
    } else {
        const migrationEnv = { ...process.env, DATABASE_URL: migrationUrl.toString() };
        delete migrationEnv.NEON_MIGRATION_DATABASE_URL;
        delete migrationEnv.NEON_RUNTIME_PASSWORD;
        const migrated = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
            env: migrationEnv, encoding: "utf8", timeout: 120000,
        });
        for (const output of [migrated.stdout, migrated.stderr]) {
            if (output) console.log(output.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL redacted]"));
        }
        assert.equal(migrated.status, 0);

        owner = new pg.Client({ connectionString: migrationUrl.toString(), connectionTimeoutMillis: 15000 });
        await owner.connect();
        const existing = await owner.query("SELECT 1 FROM pg_roles WHERE rolname = $1", ["auth_service_runtime"]);
        assert.equal(existing.rowCount, 0, "Runtime role already exists; stop for private review rather than rotate credentials");
        await owner.query("BEGIN");
        await owner.query("CREATE ROLE auth_service_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD " + owner.escapeLiteral(process.env.NEON_RUNTIME_PASSWORD));
        await owner.query("GRANT CONNECT ON DATABASE neondb TO auth_service_runtime");
        await owner.query("GRANT USAGE ON SCHEMA public TO auth_service_runtime");
        await owner.query('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."User", public."RefreshToken", public."AuditLog" TO auth_service_runtime');
        await owner.query("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO auth_service_runtime");
        await owner.query("COMMIT");
        await owner.end();
        owner = undefined;

        const runtimeUrl = new URL(migrationUrl);
        const hostParts = runtimeUrl.hostname.split(".");
        hostParts[0] += "-pooler";
        runtimeUrl.hostname = hostParts.join(".");
        runtimeUrl.username = "auth_service_runtime";
        runtimeUrl.password = process.env.NEON_RUNTIME_PASSWORD;
        runtime = new pg.Client({ connectionString: runtimeUrl.toString(), connectionTimeoutMillis: 15000 });
        await runtime.connect();
        const privileges = await runtime.query("SELECT rolsuper, rolcreatedb, rolcreaterole, has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create, has_table_privilege(current_user, 'public.\"_prisma_migrations\"', 'SELECT') AS migration_read FROM pg_roles WHERE rolname = current_user");
        for (const value of Object.values(privileges.rows[0])) assert.equal(value, false);
        console.log("Restricted pooled runtime connection verified: no superuser, database/role creation, schema creation or migration-table access");

        const appEnv = {
            ...migrationEnv, DATABASE_URL: runtimeUrl.toString(), PORT: "18082",
            JWT_SECRET: randomBytes(48).toString("hex"), NODE_ENV: "production",
            REDIS_URL: "redis://127.0.0.1:6379", DEMO_READ_ONLY: "false",
        };
        server = spawn(process.execPath, ["dist/index.js"], { env: appEnv, stdio: ["ignore", "pipe", "pipe"] });
        serverExit = new Promise((resolve) => { server.once("exit", (code) => resolve(code)); });
        server.stderr.on("data", () => {});
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("API startup timed out")), 15000);
            let output = "";
            server.stdout.on("data", (chunk) => {
                output += chunk.toString();
                if (output.includes("Server running on port 18082")) { clearTimeout(timeout); resolve(); }
            });
            server.once("error", () => { clearTimeout(timeout); reject(new Error("API could not start")); });
            server.once("exit", () => { clearTimeout(timeout); reject(new Error("API exited before listening")); });
        });

        const request = async (method, path, expectedStatus, body, token) => {
            const response = await fetch(`http://127.0.0.1:18082${path}`, {
                method, signal: AbortSignal.timeout(15000),
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            assert.equal(response.status, expectedStatus, `${method} ${path}`);
            console.log(`${method} ${path} -> ${response.status}`);
            return response.status === 204 ? undefined : response.json();
        };
        await request("GET", "/health/ready", 200);
        fixtureEmail = `release-${randomUUID()}@example.com`;
        const password = randomBytes(24).toString("hex");
        const created = await request("POST", "/auth/signup", 201, { email: fixtureEmail, password });
        assert.deepEqual(Object.keys(created).sort(), ["email", "id"]);
        const loggedIn = await request("POST", "/auth/login", 200, { email: fixtureEmail, password });
        const profile = await request("GET", "/me", 200, undefined, loggedIn.accessToken);
        assert.deepEqual(Object.keys(profile).sort(), ["createdAt", "email", "id", "role"]);
        await request("GET", "/admin/dashboard", 403, undefined, loggedIn.accessToken);
        const rotated = await request("POST", "/auth/refresh", 200, { refreshToken: loggedIn.refreshToken });
        await request("POST", "/auth/refresh", 401, { refreshToken: loggedIn.refreshToken });
        await request("POST", "/auth/logout", 204, { refreshToken: rotated.refreshToken });
        await request("POST", "/auth/refresh", 401, { refreshToken: rotated.refreshToken });
        console.log("Neon-backed auth flow passed using the restricted runtime role");
    }
} catch {
    console.error("Neon release failed; inspect the safe step/status output. No credential values or raw database errors are printed.");
    process.exitCode = 1;
} finally {
    if (server) {
        server.kill("SIGTERM");
        const timeout = setTimeout(() => server.kill("SIGKILL"), 12000);
        const code = await serverExit;
        clearTimeout(timeout);
        if (code !== 0) process.exitCode = 1;
    }
    try {
        if (runtime && fixtureEmail) {
            await runtime.query("BEGIN");
            await runtime.query('DELETE FROM public."AuditLog" WHERE "actorId" IN (SELECT id FROM public."User" WHERE email = $1)', [fixtureEmail]);
            await runtime.query('DELETE FROM public."User" WHERE email = $1', [fixtureEmail]);
            await runtime.query("COMMIT");
            console.log("Synthetic release account and its audit/session records removed");
        }
    } catch {
        console.error("Synthetic fixture cleanup failed; private review required");
        process.exitCode = 1;
    } finally {
        if (runtime) await runtime.end();
        if (owner) await owner.end();
    }
}