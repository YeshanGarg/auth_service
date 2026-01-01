import { Router } from "express";
import { SignupController } from "../controllers/auth.controller.js";

const router = Router();

router.post("/signup",SignupController);

export default router;