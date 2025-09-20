import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getDominios,
  getDominioById,
  createDominio,
  updateDominio,
  deleteDominio,
  getDominioItens,
  getDominioItemById,   // <- exposto
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
  .post(authorize("admin", "financeiro"), createDominio); // <- opcional abrir p/ financeiro

router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor"), getDominioById)
  .put(authorize("admin", "financeiro"), updateDominio)   // <- opcional abrir p/ financeiro
  .delete(authorize("admin"), deleteDominio);

// Itens do Domínio
router
  .route("/:dominio_id/itens")
  .get(authorize("admin", "financeiro", "vendedor"), getDominioItens)
  .post(authorize("admin", "financeiro"), createDominioItem); // <- opcional abrir p/ financeiro

router
  .route("/:dominio_id/itens/:id")
  .get(authorize("admin", "financeiro", "vendedor"), getDominioItemById) // <- novo GET
  .put(authorize("admin", "financeiro"), updateDominioItem)              // <- opcional abrir p/ financeiro
  .delete(authorize("admin"), deleteDominioItem);

export default router;
