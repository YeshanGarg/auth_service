import jwt from "jsonwebtoken";
import crypto from "crypto";

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
};

export const generateAccessToken = (payload: object) => {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: "15m",
        algorithm: "HS256",
        issuer: "auth-service",
        audience: "auth-service-api",
    });
};

// export const generateRefreshToken = () => {
//     return crypto.randomUUID();
// };

export const generateRefreshToken = () => {
    return crypto.randomBytes(32).toString("base64url");
};

export const hashRefreshToken = (token: string) => {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
};