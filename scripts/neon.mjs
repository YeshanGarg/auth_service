import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import dotenv from "dotenv";

try {
    const mode = process.argv[2];
    const checkOnly = process.argv[3] === "--check";
    if (!["start", "migrate"].includes(mode) ||
        (process.argv[3] !== undefined && !checkOnly) || process.argv.length > 4) {
        throw new Error("Use start or migrate, optionally followed by --check");
    }

    dotenv.config({ quiet: true });
    const cloud = dotenv.parse(readFileSync(".env.neon"));
    const direct = new URL(cloud.DATABASE_URL_UNPOOLED);
    const source = mode === "migrate"
        ? dotenv.parse(readFileSync(".env.deploy"))
        : existsSync(".env.neon.runtime")
            ? dotenv.parse(readFileSync(".env.neon.runtime"))
            : cloud;
    const database = new URL(source.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(database.protocol) ||
        !direct.hostname.endsWith(".neon.tech") || direct.hostname.includes("-pooler") ||
        database.hostname.replace("-pooler.", ".") !== direct.hostname ||
        database.pathname !== direct.pathname ||
        (mode === "migrate" && database.hostname.includes("-pooler"))) {
        throw new Error("Database URLs must target the same Neon database; migrations require a direct URL");
    }
    database.searchParams.set("sslmode", "verify-full");

    if (checkOnly) {
        console.log(`Neon ${mode} configuration valid; TLS verification enforced; no connection attempted`);
    } else {
        const args = mode === "migrate"
            ? ["node_modules/prisma/build/index.js", "migrate", "deploy"]
            : ["dist/index.js"];
        const child = spawn(process.execPath, args, {
            env: { ...process.env, DATABASE_URL: database.toString() },
            stdio: "inherit",
        });
        child.once("error", () => {
            console.error("Unable to start the Neon command");
            process.exitCode = 1;
        });
        child.once("exit", (code) => { process.exitCode = code ?? 1; });
        process.once("SIGINT", () => { child.kill("SIGINT"); });
        process.once("SIGTERM", () => { child.kill("SIGTERM"); });
    }
} catch {
    console.error("Neon setup failed. Check the command and ignored .env.neon/.env.deploy files; migrations require a matching direct URL.");
    process.exitCode = 1;
}