import { Router } from "express";
import { SignupController } from "../controllers/auth.controller.js";
import { LoginController } from "../controllers/auth.controller.js";

const router = Router();

router.post("/signup",SignupController);

router.post("/login",LoginController);

export default router;