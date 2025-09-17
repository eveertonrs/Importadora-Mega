import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getDominios,
  getDominioById,
  createDominio,
  updateDominio,
  deleteDominio,
  getDominioItens,
  createDominioItem,
  updateDominioItem,
  deleteDominioItem,
} from "../controllers/dominios.controller";

const router = Router();

router.use(protect);

// Domínios
router
  .route("/")
  .get(authorize("admin", "financeiro", "vendedor"), getDominios)
  .post(authorize("admin"), createDominio);

router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor"), getDominioById)
  .put(authorize("admin"), updateDominio)
  .delete(authorize("admin"), deleteDominio);

// Itens do Domínio
router
  .route("/:dominio_id/itens")
  .get(authorize("admin", "financeiro", "vendedor"), getDominioItens)
  .post(authorize("admin"), createDominioItem);

router
  .route("/:dominio_id/itens/:id")
  .put(authorize("admin"), updateDominioItem)
  .delete(authorize("admin"), deleteDominioItem);

export default router;
