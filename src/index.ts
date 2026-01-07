import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import { authorize } from "./middlewares/role.middleware.js";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/",(_,res) => {
    res.send("Auth service running");
});

app.get("/profile", authenticate , (req , res) => {
    res.json({
        message: "Access Granted",
        user: req.user,
    });
});

app.use("/auth",authRoutes);

app.get("/admin/dashboard", authenticate, authorize(["ADMIN"]) , (req, res) => {
    res.json({
        message: "Welcome Admin",
        user: req.user,
    });
});

app.listen(3000,() => {
    console.log("Server running on port 3000");
});