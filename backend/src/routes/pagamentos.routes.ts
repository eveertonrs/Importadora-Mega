import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getPagamentos, getPagamentoById, createPagamento, updatePagamento, deletePagamento, getSaldo, getHistorico } from "../controllers/pagamentos.controller";

const router = Router();

router.use(protect);

router.route("/")
  .get(getPagamentos)
  .post(createPagamento);

router.route("/:id")
  .get(getPagamentoById)
  .put(updatePagamento)
  .delete(deletePagamento);

router.get("/:cliente_id/saldo", protect, getSaldo);
router.get("/:cliente_id/historico", protect, getHistorico);

export default router;
