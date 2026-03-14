import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  createBloco,
  addPedidoToBloco,
  addLancamentoToBloco,
  getBlocoSaldo,
  getBlocoSaldos,
  fecharBloco,
  reabrirBloco,
  deleteBloco,
  unlinkPedido,
  listBlocos,
  getBlocoById,
  listPedidosDoBloco,
  listLancamentosDoBloco,
  deleteLancamento,
} from "../controllers/blocos.controller";

const router = Router();

router.use(protect);

// Blocos
router.get("/", authorize("admin", "financeiro", "vendedor", "administrativo"), listBlocos);
router.post("/", authorize("admin", "financeiro", "administrativo"), createBloco);
router.get("/:id", authorize("admin", "financeiro", "vendedor", "administrativo"), getBlocoById);

// Saldos
router.get("/:id/saldo", authorize("admin", "financeiro", "vendedor", "administrativo"), getBlocoSaldo);
router.get("/:id/saldos", authorize("admin", "financeiro", "vendedor", "administrativo"), getBlocoSaldos);

// Fechamento (permanece admin/financeiro)
router.post("/:id/fechar", authorize("admin", "financeiro"), fecharBloco);
// Reabrir: todos usuários autorizados
router.patch("/:id/reabrir", authorize("admin", "financeiro", "vendedor", "administrativo"), reabrirBloco);
// Excluir bloco: somente admin; bloqueado se houver lançamento CONFIRMADO na conferência
router.delete("/:id", authorize("admin"), deleteBloco);

// Pedidos
router.get("/:id/pedidos", authorize("admin", "financeiro", "vendedor", "administrativo"), listPedidosDoBloco);
router.post("/:id/pedidos", authorize("admin", "financeiro", "administrativo"), addPedidoToBloco);
// Excluir pedido do bloco: somente admin (retirado "financeiro")
router.delete("/:id/pedidos/:pedido_id", authorize("admin"), unlinkPedido);

// Lançamentos
router.get("/:id/lancamentos", authorize("admin", "financeiro", "vendedor", "administrativo"), listLancamentosDoBloco);
router.post("/:id/lancamentos", authorize("admin", "financeiro", "administrativo"), addLancamentoToBloco);
// Excluir lançamento: qualquer um dos perfis (somente se status PENDENTE)
router.delete("/:id/lancamentos/:lanc_id", authorize("admin", "financeiro", "vendedor", "administrativo"), deleteLancamento);

export default router;
