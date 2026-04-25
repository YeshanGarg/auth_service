import { z } from "zod";

export const signupSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});

export const LoginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});

export const listUsersQuerySchema = z.object({
    cursor: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});