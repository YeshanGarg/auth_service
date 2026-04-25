import { getUsers } from "../services/user.service.js";
import type { Request, Response } from "express";
import { listUsersQuerySchema } from "../utils/validators.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listUsers = asyncHandler(
    async (req: Request, res: Response) => {
        const { cursor, limit } = listUsersQuerySchema.parse(req.query);
        const users = await getUsers({
            limit,
            ...(cursor ? { cursor } : {}),
        });
        res.json(users);
    }
);