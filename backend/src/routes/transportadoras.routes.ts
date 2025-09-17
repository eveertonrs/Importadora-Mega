import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getTransportadoras,
  getTransportadoraById,
  createTransportadora,
  updateTransportadora,
  deleteTransportadora,
} from "../controllers/transportadoras.controller";

const router = Router();

router.use(protect);

router
  .route("/")
  .get(authorize("admin", "financeiro", "vendedor"), getTransportadoras)
  .post(authorize("admin", "financeiro"), createTransportadora);

router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor"), getTransportadoraById)
  .put(authorize("admin", "financeiro"), updateTransportadora)
  .delete(authorize("admin", "financeiro"), deleteTransportadora);

export default router;
