import { Router } from "express";
import { logoutController, refreshController, SignupController } from "../controllers/auth.controller.js";
import { LoginController } from "../controllers/auth.controller.js";
// import { seedDemoAdminController } from "../controllers/auth.controller.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/signup",rateLimit({ windowSeconds: 60 , maxRequests: 3}),SignupController);

router.post("/login",rateLimit({ windowSeconds: 60 , maxRequests: 5}),LoginController);

// router.post("/refresh",refreshController);

router.post("/logout", rateLimit({ windowSeconds: 60 , maxRequests: 5}), logoutController);

router.post("/refresh", rateLimit({ windowSeconds: 60, maxRequests: 20 }), refreshController);

// router.post("/demo/seed-admin", seedDemoAdminController);

export default router;