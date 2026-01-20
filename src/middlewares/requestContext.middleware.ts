import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export const requestContext = (req: Request, res: Response, next: NextFunction) => {
    req.context = {
        requestId: randomUUID(),
        ip: req.ip,
        userAgent: req.headers["user-agent"],
    };

    res.setHeader("X-Request-ID", req.context.requestId);
    next();
}