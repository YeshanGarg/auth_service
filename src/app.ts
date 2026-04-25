import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import swaggerUi from "swagger-ui-express";
import type { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import { authorize } from "./middlewares/role.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestContext } from "./middlewares/requestContext.middleware.js";
import openApiSpec from "./docs/openapi.js";

dotenv.config();

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowNoOrigin = process.env.CORS_ALLOW_NO_ORIGIN !== "false";
const docsEnabled = process.env.DOCS_ENABLED !== "false";
const docsVisibility = process.env.DOCS_VISIBILITY || "public";
const docsAccessToken = process.env.DOCS_ACCESS_TOKEN;

const docsAccessMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!docsEnabled) {
        return res.status(404).json({ message: "Not found" });
    }

    if (docsVisibility === "private") {
        if (!docsAccessToken) {
            return res.status(503).json({ message: "Docs are not configured" });
        }

        const queryKey = typeof req.query.key === "string" ? req.query.key : undefined;
        const headerKey = req.headers["x-docs-key"];
        const providedKey = typeof headerKey === "string" ? headerKey : queryKey;

        if (providedKey !== docsAccessToken) {
            return res.status(401).json({ message: "Unauthorized" });
        }
    }

    next();
};

app.use(express.json({ limit: "10kb" }));
app.use(helmet());
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, allowNoOrigin);
            }
            return callback(null, allowedOrigins.includes(origin));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
    })
);
app.use(hpp());
app.disable("x-powered-by");
app.use(requestContext);

app.get("/", (_, res) => {
    res.send("Auth service running");
});

app.get("/openapi.json", docsAccessMiddleware, (_, res) => {
    res.json(openApiSpec);
});

app.use(
    "/docs",
    docsAccessMiddleware,
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
        customSiteTitle: "Auth Service Demo Docs",
    })
);

app.get("/profile", authenticate, (req, res) => {
    res.json({
        message: "Access Granted",
        user: req.user,
    });
});

app.use("/users", userRoutes);
app.use("/auth", authRoutes);

app.get("/admin/dashboard", authenticate, authorize(["ADMIN"]), (req, res) => {
    res.json({
        message: "Welcome Admin",
        user: req.user,
    });
});

app.use(errorHandler);

export default app;