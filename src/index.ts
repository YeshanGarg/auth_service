import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/",(_,res) => {
    res.send("Auth service running");
});

app.use("/auth",authRoutes);

app.listen(3000,() => {
    console.log("Server running on port 3000");
});