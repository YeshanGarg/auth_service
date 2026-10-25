import bcrypt from "bcrypt";
//import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
//import type { StringValue } from "ms";
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from "../utils/token.js";
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

    const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
        data: {
            email: input.email,
            password: hashedPassword,
        },
    });

    await tx.auditLog.create({
        data: {
            id: randomUUID(),
            action: "USER_SIGNUP",
            actorId: createdUser.id,
            metadata: { requestId: context?.requestId ?? null },
            createdAt: new Date(),
            ip: context?.ip ?? null,
            userAgent: context?.userAgent ?? null,
            entity: "User",
        },
    });
    return createdUser;
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
            metadata: { requestId: context?.requestId ?? null },
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
            tokenHash: hashRefreshToken(refreshToken),
            userId: user.id,
            expiresAt: new Date(Date.now()+ 7* 24 * 60 * 60 * 1000),
        },
    });

    await tx.auditLog.create({
        data: {
            id: randomUUID(),
            action: "REFRESH_TOKEN_CREATED",
            actorId: user.id,
            metadata: { requestId: context?.requestId ?? null },
            createdAt: new Date(),
            ip: context?.ip ?? null,
            userAgent: context?.userAgent ?? null,
            entity: "User",
        },
    });

    return { accessToken, refreshToken };
    });
};

export const refreshAccessToken = async (refreshToken: string, context?: RequestContext) => {
    return prisma.$transaction(async (tx) => {
        const storedToken = await tx.refreshToken.findUnique({
            where: { tokenHash: hashRefreshToken(refreshToken) },
            include: { user: true },
        });

        if (!storedToken || storedToken.expiresAt <= new Date() || storedToken.user.deletedAt) {
            throw new AppError("Invalid refresh token", 401);
        }

        const consumed = await tx.refreshToken.deleteMany({
            where: {
                id: storedToken.id,
                expiresAt: { gt: new Date() },
            },
        });

        if (consumed.count !== 1) {
            throw new AppError("Invalid refresh token", 401);
        }

        const newAccessToken = generateAccessToken({
            userId: storedToken.user.id,
            role: storedToken.user.role,
        });

        const newRefreshToken = generateRefreshToken();

        await tx.refreshToken.create({
            data: {
                tokenHash: hashRefreshToken(newRefreshToken),
                userId: storedToken.user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });

        await tx.auditLog.create({
            data: {
                id: randomUUID(),
                action: "REFRESH_TOKEN_ROTATED",
                actorId: storedToken.user.id,
                metadata: { requestId: context?.requestId ?? null },
                createdAt: new Date(),
                ip: context?.ip ?? null,
                userAgent: context?.userAgent ?? null,
                entity: "User",
            },
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    });
};

export const logout = async (refreshToken: string, context?: RequestContext) => {
    await prisma.$transaction(async (tx) => {
        const tokenHash = hashRefreshToken(refreshToken);
        const session = await tx.refreshToken.findUnique({
            where: { tokenHash },
            select: { id: true, userId: true },
        });
        if (!session) return;
        const revoked = await tx.refreshToken.deleteMany({ where: { id: session.id } });
        if (revoked.count === 1) {
            await tx.auditLog.create({
                data: {
                    action: "SESSION_LOGOUT",
                    actorId: session.userId,
                    metadata: { requestId: context?.requestId ?? null },
                    entity: "User",
                    ip: context?.ip ?? null,
                    userAgent: context?.userAgent ?? null,
                },
            });
        }
    });
};

// export const seedDemoAdmin = async (context?: RequestContext) => {
//     const email = process.env.DEMO_ADMIN_EMAIL || "admin.demo@example.com";
//     const password = process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin123!";
//     const hashedPassword = await bcrypt.hash(password, 12);

//     const user = await prisma.user.upsert({
//         where: { email },
//         update: {
//             password: hashedPassword,
//             role: "ADMIN",
//             deletedAt: null,
//         },
//         create: {
//             email,
//             password: hashedPassword,
//             role: "ADMIN",
//         },
//     });

//     await prisma.auditLog.create({
//         data: {
//             id: randomUUID(),
//             action: "DEMO_ADMIN_SEEDED",
//             actorId: user.id,
//             createdAt: new Date(),
//             ip: context?.ip ?? null,
//             userAgent: context?.userAgent ?? null,
//             entity: "User",
//         },
//     });

//     return {
//         email,
//         password,
//         role: user.role,
//     };
// };