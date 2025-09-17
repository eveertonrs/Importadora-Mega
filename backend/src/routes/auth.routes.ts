import { Router } from "express";
import { login, register } from "../controllers/auth.controller";
import { protect, authorize } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", protect, authorize("admin"), register);

export default router;
