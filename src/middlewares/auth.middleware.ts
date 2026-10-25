import type { Request,Response,NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";

// interface JWTPayload {
//     userId: number;
//     role: string;
// }

const readJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
};

// export const authenticate = (req:Request, res:Response, nxt:NextFunction) => {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//         return res.status(401).json({ message: "Unauthorized" });
//     }

//     const token = authHeader.split(" ")[1];

//     if (!token) {
//         return res.status(401).json({ message: "Unauthorized" });
//     }

//     try {
//         const decoded = jwt.verify(
//             token,
//             readJwtSecret()
//         ) as JWTPayload;

//         req.user = decoded;
//         nxt();
//     }  catch {
//         return res.status(401).json({ message : "Invalid Token"});
//     }
// };

export const authenticate = async (req: Request, res: Response, nxt: NextFunction) => {
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? "");
    if (!match) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    let decoded: jwt.JwtPayload | string;
    try {
        decoded = jwt.verify(match[1]!, readJwtSecret(), {
            algorithms: ["HS256"],
            issuer: "auth-service",
            audience: "auth-service-api",
        });
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError ||
            error instanceof jwt.NotBeforeError) {
            return res.status(401).json({ message: "Invalid Token" });
        }
        return nxt(error);
    }

    if (typeof decoded === "string" ||
        typeof decoded.userId !== "number" ||
        !Number.isSafeInteger(decoded.userId) || decoded.userId <= 0 ||
        typeof decoded.exp !== "number" ||
        !["USER", "ADMIN"].includes(decoded.role)) {
        return res.status(401).json({ message: "Invalid Token" });
    }

    try {
        const user = await prisma.user.findFirst({
            where: { id: decoded.userId, deletedAt: null },
            select: { id: true, role: true },
        });
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        req.user = { userId: user.id, role: user.role };
    } catch (error) {
        return nxt(error);
    }
    return nxt();
};