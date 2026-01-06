import jwt from "jsonwebtoken";
import crypto from "crypto";

export const generateAccessToken = (payload: object) => {
    return jwt.sign(payload, process.env.JWT_SECRET as string , {
        expiresIn: "15m",
    });
};

export const generateRefreshToken = () => {
    return crypto.randomUUID();
};