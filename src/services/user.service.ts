import { prisma } from "../config/prisma.js";
import { getPagination } from "../utils/pagination.js";

export const getUsers = async({
    cursor,
    limit,
} : {
    cursor?: number,
    limit: number,
}) => {
    const user = await prisma.user.findMany({
        where: {
            deletedAt: null,
        },
        ...getPagination(cursor, limit),
        orderBy: { createdAt: "desc" }
    });
    return user;
};

export const softDeleteUser = async (userId: number) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user || user.deletedAt) {
        return; // already deleted or never existed
    }

    return prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { deletedAt: new Date() },
        });

        await tx.refreshToken.deleteMany({
            where: { userId }
        });
    });
};