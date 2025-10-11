import { Router } from "express";
import * as ctrl from "../controllers/pedidoParametros.controller";
import { protect, authorize } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

// GET /pedido-parametros?tipo=&ativo=&q=
router.get("/", ctrl.list);

// POST /pedido-parametros { tipo, descricao, exige_bom_para?, exige_tipo_cheque? }
router.post("/", ctrl.create);

// PATCH /pedido-parametros/:id { descricao?, ativo?, tipo?, exige_bom_para?, exige_tipo_cheque? }
router.patch("/:id", ctrl.update);

// PATCH /pedido-parametros/:id/toggle
router.patch("/:id/toggle", ctrl.toggle);

// DELETE /pedido-parametros/:id
router.delete("/:id", ctrl.remove);

export default router;
