import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { ZodError } from "zod";

// export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {

//     logger.error("Unhandled error", {
//             message: err.message,
//             stack: err.stack,
//             requestId: req.context?.requestId,
//     });
    
//     if (err instanceof Prisma.PrismaClientKnownRequestError){
//         if (err.code === 'P2002') {
//             return res.status(409).json({
//                 message: "Duplicate field value"
//             });
//         }
//     }

//     if (err instanceof AppError) {
//         return res.status(err.statusCode).json({
//             message: err.message
//         });
//     }

//     console.error("Unexpected Error : ",err);

//     return res.status(500).json({
//         message: "Internal server error"
//     });
// };

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (res.headersSent) return _next(err);
    const context = req.context ? { requestId: req.context.requestId } : {};
    if (err && typeof err === "object" && "type" in err) {
        if (err.type === "entity.parse.failed") {
            return res.status(400).json({ message: "Invalid JSON", ...context });
        }
        if (err.type === "entity.too.large") {
            return res.status(413).json({ message: "Request body too large", ...context });
        }
    }
    if (err instanceof ZodError) {
        return res.status(400).json({
            message: "Invalid request",
            ...context,
            issues: err.issues.map((issue) => ({
                path: issue.path.map(String).join("."),
                message: issue.message,
            })),
        });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Duplicate field value", ...context });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message, ...context });
    }

    logger.error("Unhandled error", {
        name: err instanceof Error ? err.name : "UnknownError",
        requestId: req.context?.requestId,
    });

    return res.status(500).json({ message: "Internal server error", ...context });
};