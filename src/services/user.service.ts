import { prisma } from "../config/prisma.js";
import { getPagination } from "../utils/pagination.js";

export const getCurrentUser = (userId: number) => prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, role: true, createdAt: true },
});

export const getUsers = async({
    cursor,
    limit,
} : {
    cursor?: number,
    limit: number,
}) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
        },
        where: {
            deletedAt: null,
        },
        ...getPagination(cursor, limit),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const hasMore = users.length > limit;
    const items = users.slice(0, limit);

    return {
        items,
        nextCursor: hasMore ? items.at(-1)!.id : null,
    };
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