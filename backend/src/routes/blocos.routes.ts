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
  deleteLancamento,          // ⟵ NOVO
} from "../controllers/blocos.controller";

const router = Router();

router.use(protect);

// Blocos
router.get("/", authorize("admin", "financeiro", "vendedor"), listBlocos);
router.post("/", authorize("admin", "financeiro"), createBloco);
router.get("/:id", authorize("admin", "financeiro", "vendedor"), getBlocoById);

// Saldos
router.get("/:id/saldo", authorize("admin", "financeiro", "vendedor"), getBlocoSaldo);
router.get("/:id/saldos", authorize("admin", "financeiro", "vendedor"), getBlocoSaldos);

// Fechamento
router.post("/:id/fechar", authorize("admin", "financeiro"), fecharBloco);

// Pedidos
router.get("/:id/pedidos", authorize("admin", "financeiro", "vendedor"), listPedidosDoBloco);
router.post("/:id/pedidos", authorize("admin", "financeiro", "vendedor"), addPedidoToBloco);
router.delete("/:id/pedidos/:pedido_id", authorize("admin", "financeiro"), unlinkPedido);

// Lançamentos
router.get("/:id/lancamentos", authorize("admin", "financeiro", "vendedor"), listLancamentosDoBloco);
router.post("/:id/lancamentos", authorize("admin", "financeiro"), addLancamentoToBloco);
router.delete("/:id/lancamentos/:lanc_id", authorize("admin", "financeiro"), deleteLancamento); // ⟵ NOVO

export default router;
