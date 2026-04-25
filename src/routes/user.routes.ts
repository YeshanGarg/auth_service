import { Router } from "express";
import { listUsers } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", authenticate, authorize(["ADMIN"]), listUsers);

export default router;