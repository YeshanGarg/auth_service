import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url().refine((value) => /^postgres(?:ql)?:\/\//.test(value)),
    JWT_SECRET: z.string().min(32),
    REDIS_URL: z.url().refine((value) => /^rediss?:\/\//.test(value)).optional(),
    DEMO_READ_ONLY: z.enum(["true", "false"]).default("false"),
    REDIS_HOST: z.string().min(1).default("127.0.0.1"),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
    TRUST_PROXY: z.string().default("").refine((value) => !/^(true|\d+)$/i.test(value)),
    DOCS_ENABLED: z.enum(["true", "false"]).default("true"),
    DOCS_VISIBILITY: z.enum(["public", "private"]).default("public"),
    DOCS_ACCESS_TOKEN: z.string().optional(),
}).superRefine((value, context) => {
    if (value.DOCS_ENABLED === "true" && value.DOCS_VISIBILITY === "private" &&
        (!value.DOCS_ACCESS_TOKEN || value.DOCS_ACCESS_TOKEN.length < 32)) {
        context.addIssue({ code: "custom", path: ["DOCS_ACCESS_TOKEN"], message: "Private docs require a token of at least 32 characters" });
    }
});

export const validateEnvironment = (input: NodeJS.ProcessEnv = process.env) => {
    const result = environmentSchema.safeParse(input);
    if (!result.success) {
        const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
        throw new Error(`Invalid configuration: ${fields.join(", ")}`);
    }
    return result.data;
};