import type { Request,Response,NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JWTPayload {
    userId: number;
    role: string;
}

const readJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
};

export const authenticate = (req:Request, res:Response, nxt:NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) { 
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const decoded = jwt.verify(
            token,
            readJwtSecret()
        ) as JWTPayload;

        req.user = decoded;
        nxt();
    }  catch {
        return res.status(401).json({ message : "Invalid Token"});
    }
};