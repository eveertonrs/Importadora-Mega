import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getDominios, getDominioById, createDominio, updateDominio, deleteDominio, getDominioItens, createDominioItem, updateDominioItem, deleteDominioItem } from "../controllers/dominios.controller";

const router = Router();

router.use(protect);

router.route("/")
  .get(getDominios)
  .post(createDominio);

router.route("/:id")
  .get(getDominioById)
  .put(updateDominio)
  .delete(deleteDominio);

router.route("/:dominio_id/itens")
  .get(getDominioItens)
  .post(createDominioItem);

router.route("/:dominio_id/itens/:id")
  .put(updateDominioItem)
  .delete(deleteDominioItem);

export default router;
