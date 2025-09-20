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

router.use(protect);

// histórico compatível com o front: /pagamentos/historico?cliente_id=...
router.get("/historico", getHistorico);

// saldo por cliente (mantido)
router.get("/:cliente_id/saldo", getSaldo);

// lista genérica / cria
router.route("/")
  .get(getPagamentos)
  .post(createPagamento);

// detalhe / update / delete
router.route("/:id")
  .get(getPagamentoById)
  .put(updatePagamento)
  .delete(deletePagamento);

export default router;
