import type { Request,Response } from "express";
import { LoginSchema, refreshSchema, signupSchema } from "../utils/validators.js";
import { login, refreshAccessToken, seedDemoAdmin, signup } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const SignupController = asyncHandler(
    async (req:Request , res:Response) => {
        const data = signupSchema.parse(req.body);
        const user = await signup(
            {
                email: data.email,
                password: data.password,
            },
            req.context
        );
        res.status(201).json({
            id: user.id,
            email: user.email,
        });
});

export const LoginController = asyncHandler (
    async (req:Request, res:Response) => {
        const data = LoginSchema.parse(req.body);
        const result = await login(
            {
                email: data.email,
                password: data.password,
            },
            req.context
        );
        res.json(result);
});

export const refreshController = asyncHandler(
    async (req: Request, res:Response  ) =>{
        const { refreshToken } = refreshSchema.parse(req.body);
        const result = await refreshAccessToken(refreshToken, req.context);

        res.json(result);
});

export const seedDemoAdminController = asyncHandler(
    async (req: Request, res: Response) => {
        const isDemoEnabled = process.env.DEMO_MODE === "true" || process.env.ENABLE_DEMO_ROUTES === "true";

        if (!isDemoEnabled) {
            throw new AppError("Not found", 404);
        }

        const result = await seedDemoAdmin(req.context);
        res.status(201).json(result);
    }
);