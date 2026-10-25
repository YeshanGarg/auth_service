import app from "./app.js";
import { validateEnvironment } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { redis } from "./config/redis.js";

const { PORT: port } = validateEnvironment();

const server = app.listen(port,() => {
    console.log(`Server running on port ${port}`);
});

let stopping = false;
const shutdown = async (reason: string, exitCode = 0) => {
    if (stopping) return;
    stopping = true;
    console.log(`Stopping server: ${reason}`);
    const deadline = setTimeout(() => {
        server.closeAllConnections();
        redis.disconnect();
        process.exit(1);
    }, 10000);
    deadline.unref();
    try {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await prisma.$disconnect();
        if (redis.status === "wait" || redis.status === "end") {
            redis.disconnect();
        } else {
            await redis.quit();
        }
        process.exitCode = exitCode;
    } catch {
        redis.disconnect();
        process.exitCode = 1;
    } finally {
        clearTimeout(deadline);
    }
};

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("uncaughtException", () => { void shutdown("uncaught exception", 1); });
process.on("unhandledRejection", () => { void shutdown("unhandled rejection", 1); });
server.on("error", () => { void shutdown("HTTP server failure", 1); });