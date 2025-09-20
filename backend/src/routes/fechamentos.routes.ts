// src/routes/fechamentos.routes.ts
import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getFechamento,
  createFechamento,
  reprocessFechamento,
} from "../controllers/fechamentos.controller";

const router = Router();

// todas as rotas exigem autenticação
router.use(protect);

/**
 * GET  /fechamentos/:data_ref        -> retorna o fechamento do dia (YYYY-MM-DD)
 * POST /fechamentos/:data_ref        -> cria o fechamento do dia (snapshot)
 */
router
  .route("/:data_ref")
  .get(authorize("admin", "financeiro"), getFechamento)
  .post(authorize("admin", "financeiro"), createFechamento);

/**
 * POST /fechamentos/:data_ref/reprocess
 * Reprocessa (apaga itens e recaptura o snapshot do dia).
 * Mantém o cabeçalho de fechamento.
 */
router.post(
  "/:data_ref/reprocess",
  authorize("admin", "financeiro"),
  reprocessFechamento
);

export default router;
