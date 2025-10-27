import { Router } from "express";
import { login, register, me } from "../controllers/auth.controller";
import { protect, authorize } from "../middleware/auth.middleware";

const router = Router();

// públicas
router.post("/login", login);

// protegidas
router.get("/me", protect, me);
router.post("/register", protect, authorize("admin"), register);

export default router;
