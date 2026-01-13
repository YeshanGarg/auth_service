import { Router } from "express";
import { refreshController, SignupController } from "../controllers/auth.controller.js";
import { LoginController } from "../controllers/auth.controller.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/signup",rateLimit({ windowSeconds: 60 , maxRequests: 3}),SignupController);

router.post("/login",rateLimit({ windowSeconds: 60 , maxRequests: 5}),LoginController);

router.post("/refresh",refreshController);

export default router;