import type { Request,Response } from "express";
import { signupSchema } from "../utils/validators.js";
import { signup } from "../services/auth.service.js";
export const SignupController = async (req:Request , res:Response) => {
    const data = signupSchema.parse(req.body);
    const user = await signup(data.email,data.password);

    res.status(201).json({
        id: user.id,
        email: user.email,
    });
};