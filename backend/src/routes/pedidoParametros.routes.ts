import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import * as ctrl from "../controllers/pedidoParametros.controller";

const router = Router();

// exige token para todas as rotas abaixo
router.use(protect);

router
  .route("/")
  .get(authorize("admin", "administrador", "financeiro"), ctrl.list)
  .post(authorize("admin", "administrador", "financeiro"), ctrl.create);

router
  .route("/:id")
  .put(authorize("admin", "administrador", "financeiro"), ctrl.update);

// toggle ativo/inativo via PATCH (compat com o front)
router.patch("/:id/toggle", authorize("admin", "administrador", "financeiro"), ctrl.toggle);

export default router;
