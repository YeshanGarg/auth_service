import type { Request,Response } from "express";
import { signupSchema } from "../utils/validators.js";
import { signup } from "../services/auth.service.js";
import { LoginSchema } from "../utils/validators.js";
import { login } from "../services/auth.service.js";
import { prisma } from "../config/prisma.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
        const refreshToken = req.body;
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });

        if ( !storedToken || storedToken.expiresAt < new Date() ) {
            return res.status(401).json({
                message: "Invalid refresh token"
            })
        }

        await prisma.refreshToken.delete({
            where: { token: refreshToken }
        });

        const newAccesToken = generateAccessToken({
            userId: storedToken.user.id,
            role: storedToken.user.role,
        });

        const newRefreshToken = generateRefreshToken();

        await prisma.refreshToken.create({
            data : {
                token: newRefreshToken,
                userId: storedToken.user.id,
                expiresAt: new Date(Date.now() + 7 * 24  * 60 * 60 * 1000),
            }
        });

        res.json({
            accessToken: newAccesToken,
            refreshToken: newRefreshToken,
        });
});