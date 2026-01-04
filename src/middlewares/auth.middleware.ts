import type { Request,Response,NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JWTPayload {
    userId: number;
    role: string;
}

export const authenticate = (req:Request, res:Response, nxt:NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) { 
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    
    try {
        const decoded = jwt.verify(
            token!,
            process.env.JWT_SECRET!
        ) as JWTPayload;

        req.user = decoded;
        nxt();
    }  catch {
        return res.status(401).json({ message : "Invalid Token"});
    }
};