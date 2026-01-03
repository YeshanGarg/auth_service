import type { Request,Response } from "express";
import { signupSchema } from "../utils/validators.js";
import { signup } from "../services/auth.service.js";
import { LoginSchema } from "../utils/validators.js";
import { login } from "../services/auth.service.js";

export const SignupController = async (req:Request , res:Response) => {
    const data = signupSchema.parse(req.body);
    const user = await signup(data.email,data.password);

    res.status(201).json({
        id: user.id,
        email: user.email,
    });
};

export const LoginController = async (req:Request, res:Response) => {
    const data = LoginSchema.parse(req.body);
    const result = await login(data.email, data.password);

    res.json(result);
};