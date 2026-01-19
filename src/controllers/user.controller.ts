import { getUsers } from "../services/user.service.js";
import { Request,Response,NextFunction } from "express";

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { cursor, limit = 10 } = req.query;
        const users = await getUsers({ cursor: Number(cursor), limit: Number(limit) });
        res.json(users);
    } catch (error) {
        next(error);
    }
};