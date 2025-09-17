// src/routes/formasPagamento.routes.ts
import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import {
  getFormasPagamento,
  getFormaPagamentoById,
  createFormaPagamento,
  updateFormaPagamento,
  deleteFormaPagamento,
} from "../controllers/formasPagamento.controller";

const router = Router();

// todas as rotas exigem autenticação
router.use(protect);

// LISTAR e CRIAR
router.route("/")
  .get(getFormasPagamento)
  .post(createFormaPagamento);

// DETALHE, ATUALIZAR e EXCLUIR
router.route("/:id")
  .get(getFormaPagamentoById)
  .put(updateFormaPagamento)
  .delete(deleteFormaPagamento);

// ---- Alternativas em POST (úteis se o client não envia PUT/DELETE) ----
router.post("/:id/update", updateFormaPagamento);
router.post("/:id/delete", deleteFormaPagamento);

export default router;
