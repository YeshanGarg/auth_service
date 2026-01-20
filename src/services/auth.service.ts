import bcrypt from "bcrypt";
//import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
//import type { StringValue } from "ms";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { AppError } from "../utils/AppError.js";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";

type RequestContext = {
  requestId: string;
  ip: string | undefined;
  userAgent: string | undefined;
};

export const signup = async (input: { email: string; password: string }, context?: RequestContext) => {
    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
        data: {
            email: input.email,
            password: hashedPassword,
        },
    });

    await prisma.auditLog.create({
        data: {
            id: randomUUID(),
            action: "USER_SIGNUP",
            actorId: user.id,
            createdAt: new Date(),
            ip: context?.ip ?? null,
            userAgent: context?.userAgent ?? null,
            entity: "User",
        },
    });

    logger.info("User Signed up", {
        userId : user.id,
        requestId: context?.requestId,
    });

    return user;
};

export const login = async (input : {email: string, password:string}, context?: RequestContext) => {
    return prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
            where: {
                email: input.email,
                deletedAt: null,
            },

        });    

    if (!user) {
        throw new AppError("Invalid Credentials", 401);
    }

    const isValid = await bcrypt.compare(input.password, user.password);

    if (!isValid) {
        throw new AppError("Invalid Credentials", 401);
    }

    await tx.auditLog.create({
        data: {
            id: randomUUID(),
            action: "USER_LOGIN",
            actorId: user.id,
            createdAt: new Date(),
            ip: context?.ip ?? null,
            userAgent: context?.userAgent ?? null,
            entity: "User",
        },
    });

    logger.info("User logged in", {
        userId : user.id,
        requestId: context?.requestId,
    });

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

    await tx.auditLog.create({
        data: {
            id: randomUUID(),
            action: "REFRESH_TOKEN_CREATED",
            actorId: user.id,
            createdAt: new Date(),
            ip: context?.ip ?? null,
            userAgent: context?.userAgent ?? null,
            entity: "User",
        },
    });

    return { accessToken, refreshToken };
    });
};