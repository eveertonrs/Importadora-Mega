import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  registrarBaixaTitulo,
  listTitulos,
  conferenciaDiaria,
  conferenciaAtualizar,
} from "../controllers/financeiro.controller";

const router = Router();

router.use(protect);

// listar títulos (usado no /financeiro/receber)
router.get("/titulos", authorize("admin", "financeiro", "vendedor"), listTitulos);

// baixa de título — caminho que o front está chamando
router.post(
  "/titulos/:id/baixas",
  authorize("admin", "financeiro"),
  registrarBaixaTitulo
);

/** Conferência diária */
router.get(
  "/conferencia",
  authorize("admin", "financeiro", "vendedor"),
  conferenciaDiaria
);

router.patch(
  "/conferencia",
  authorize("admin", "financeiro"),
  conferenciaAtualizar
);

export default router;
