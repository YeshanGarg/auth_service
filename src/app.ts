import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import { authorize } from "./middlewares/role.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestContext } from "./middlewares/requestContext.middleware.js";
import openApiSpec from "./docs/openapi.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(helmet());
app.use(
    cors({
        origin: "http://localhost:3000",
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

app.get("/openapi.json", (_, res) => {
    res.json(openApiSpec);
});

app.use(
    "/docs",
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