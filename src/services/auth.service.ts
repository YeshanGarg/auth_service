import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";

export const signup = async (email: string, password:string) => {
    const hashedPassword = await bcrypt.hash(password,12);

    return prisma.user.create({
        data:{
            email,
            password: hashedPassword,
        },
    });
};