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
  .get(authorize("admin", "financeiro", "vendedor", "administrativo"), getTransportadoras)
  .post(authorize("admin", "financeiro", "administrativo"), createTransportadora);

router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor", "administrativo"), getTransportadoraById)
  .put(authorize("admin", "financeiro", "administrativo"), updateTransportadora)
  // exclusão: somente admin
  .delete(authorize("admin"), deleteTransportadora);

export default router;
