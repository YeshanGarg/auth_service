import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import type { StringValue } from "ms";

export const signup = async (email: string, password:string) => {
    const hashedPassword = await bcrypt.hash(password,12);

    return prisma.user.create({
        data:{
            email,
            password: hashedPassword,
        },
    });
};

export const login = async (email: string, password:string) => {
    const user = await prisma.user.findUnique({
        where: {email},
    });

    if (!user) {
        throw new Error("Invalid Credentials");
    }

    const isValid = await bcrypt.compare(password,user.password);

    if (!isValid) {
        throw new Error("Invalid Credentials");
    }

    const expiresInvalue = process.env.JWT_EXPIRES_IN as StringValue ?? "1h";

    const token = jwt.sign(
        { userId :user.id ,role : user.role },
        process.env.JWT_SECRET!,
        { expiresIn : expiresInvalue }
    );

    return { token };
};