import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
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

// histórico e saldo – leitura para todos perfis operacionais
router.get("/historico", authorize("admin", "financeiro", "vendedor"), getHistorico);
router.get("/:cliente_id/saldo", authorize("admin", "financeiro", "vendedor"), getSaldo);

// lista genérica / cria
router
  .route("/")
  .get(authorize("admin", "financeiro", "vendedor"), getPagamentos)
  .post(authorize("admin", "financeiro"), createPagamento);

// detalhe / update / delete
router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor"), getPagamentoById)
  .put(authorize("admin", "financeiro"), updatePagamento)
  .delete(authorize("admin", "financeiro"), deletePagamento);

export default router;
