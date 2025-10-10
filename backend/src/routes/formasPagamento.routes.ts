import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getFormasPagamento,
  getFormaPagamentoById,
  createFormaPagamento,
  updateFormaPagamento,
  deleteFormaPagamento,
} from "../controllers/formasPagamento.controller";

const router = Router();

// exige autenticação
router.use(protect);

// LISTAR (qualquer perfil) e CRIAR (admin/financeiro)
// use ?tipo=entrada|saida para alternar o domínio
router
  .route("/")
  .get(authorize("admin", "financeiro", "vendedor"), getFormasPagamento)
  .post(authorize("admin", "financeiro"), createFormaPagamento);

// DETALHE / ATUALIZAR / EXCLUIR (admin/financeiro para mutações)
// também aceita ?tipo=entrada|saida
router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor"), getFormaPagamentoById)
  .put(authorize("admin", "financeiro"), updateFormaPagamento)
  .delete(authorize("admin"), deleteFormaPagamento);

// Alternativas em POST se necessário
router.post("/:id/update", authorize("admin", "financeiro"), updateFormaPagamento);
router.post("/:id/delete", authorize("admin"), deleteFormaPagamento);

export default router;
