import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  createBloco,
  addPedidoToBloco,
  addLancamentoToBloco,
  getBlocoSaldo,
  getBlocoSaldos,
  fecharBloco,
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

// Pedidos
router.get("/:id/pedidos", authorize("admin", "financeiro", "vendedor", "administrativo"), listPedidosDoBloco);
router.post("/:id/pedidos", authorize("admin", "financeiro", "administrativo"), addPedidoToBloco);
// Excluir pedido do bloco: somente admin (retirado "financeiro")
router.delete("/:id/pedidos/:pedido_id", authorize("admin"), unlinkPedido);

// Lançamentos
router.get("/:id/lancamentos", authorize("admin", "financeiro", "vendedor", "administrativo"), listLancamentosDoBloco);
router.post("/:id/lancamentos", authorize("admin", "financeiro", "administrativo"), addLancamentoToBloco);
// Excluir lançamento: somente admin (retirado "financeiro")
router.delete("/:id/lancamentos/:lanc_id", authorize("admin"), deleteLancamento);

export default router;
