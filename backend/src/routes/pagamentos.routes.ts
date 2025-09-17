// src/routes/pagamentos.routes.ts
import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import {
  getPagamentos,
  getPagamentoById,
  createPagamento,
  updatePagamento,
  deletePagamento,
  getSaldo,
  getHistorico,
} from "../controllers/pagamentos.controller";

const router = Router();

// todas as rotas exigem autenticação
router.use(protect);

// rotas específicas por cliente (declare antes das genéricas)
router.get("/:cliente_id/saldo", getSaldo);
router.get("/:cliente_id/historico", getHistorico);

// CRUD dos lançamentos (pagamentos)
router.route("/")
  .get(getPagamentos)
  .post(createPagamento);

router.route("/:id")
  .get(getPagamentoById)
  .put(updatePagamento)
  .delete(deletePagamento);

// Se preferir apenas POST no frontend, você pode habilitar estes aliases:
// router.post("/:id/atualizar", updatePagamento);
// router.post("/:id/excluir", deletePagamento);

export default router;
