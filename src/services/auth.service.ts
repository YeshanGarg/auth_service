import bcrypt from "bcrypt";
//import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
//import type { StringValue } from "ms";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { AppError } from "../utils/AppError.js";

export const signup = async (email: string, password:string) => {
    const hashedPassword = await bcrypt.hash(password,12);

    return await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
        },
    });
};

export const login = async (email: string, password:string) => {
    return prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
            where: {
                email,
                deletedAt: null,
            },

        });    

    if (!user) {
        throw new AppError("Invalid Credentials", 401);
    }

    const isValid = await bcrypt.compare(password,user.password);

    if (!isValid) {
        throw new AppError("Invalid Credentials", 401);
    }

    const accessToken = generateAccessToken({
        userId: user.id,
        role: user.role,
    });

    const refreshToken = generateRefreshToken();

    await tx.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now()+ 7* 24 * 60 * 60 * 1000),
        },
    });

    return { accessToken, refreshToken };
    });
};