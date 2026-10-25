import { z } from "zod";

const passwordSchema = z.string().min(8).max(72).refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes"
);

export const signupSchema = z.object({
    email: z.email().max(254),
    password: passwordSchema,
});

export const LoginSchema = z.object({
    email: z.email().max(254),
    password: passwordSchema,
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1).max(512),
});

export const listUsersQuerySchema = z.object({
    cursor: z.coerce.number().int().positive().max(2147483647).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});