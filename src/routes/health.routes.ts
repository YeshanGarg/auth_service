import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";

const router = Router();

router.get("/live", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok" });
});

router.get("/ready", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
        await Promise.all([prisma.$queryRaw`SELECT 1`, redis.ping()]);
        res.json({ status: "ready" });
    } catch {
        res.status(503).json({ status: "not_ready" });
    }
});

export default router;