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
    });
};

export const generateRefreshToken = () => {
    return crypto.randomUUID();
};