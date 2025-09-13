import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getFechamento, createFechamento } from "../controllers/fechamentos.controller";

const router = Router();

router.use(protect);

router.route("/:data_ref")
  .get(getFechamento)
  .post(createFechamento);

export default router;
