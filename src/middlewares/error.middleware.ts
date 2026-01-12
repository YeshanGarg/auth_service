import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../utils/AppError.js";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError){
        if (err.code === 'P2002') {
            return res.status(409).json({
                message: "Duplicate field value"
            });
        }
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            message: err.message
        });
    }

    console.error("Unexpected Error : ",err);

    return res.status(500).json({
        message: "Internal server error"
    });
};