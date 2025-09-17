import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getFechamento, createFechamento } from "../controllers/fechamentos.controller";

const router = Router();

router.use(protect);

router
  .route("/:data_ref")
  .get(authorize("admin", "financeiro"), getFechamento)
  .post(authorize("admin", "financeiro"), createFechamento);

export default router;
