import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  createBloco,
  addPedidoToBloco,
  addLancamentoToBloco,
  getBlocoSaldo,
  getBlocoSaldos, // << novo: saldo + a receber
  fecharBloco,
  unlinkPedido,
  listBlocos,
  getBlocoById,
  listPedidosDoBloco,
  listLancamentosDoBloco,
} from "../controllers/blocos.controller";

const router = Router();

router.use(protect);

router.get("/", authorize("admin", "financeiro", "vendedor"), listBlocos);
router.post("/", authorize("admin", "financeiro"), createBloco);

router.get("/:id", authorize("admin", "financeiro", "vendedor"), getBlocoById);

// Saldo antigo (mantido para compatibilidade)
router.get("/:id/saldo", authorize("admin", "financeiro", "vendedor"), getBlocoSaldo);

// Novo: retorna { saldo, a_receber }
router.get("/:id/saldos", authorize("admin", "financeiro", "vendedor"), getBlocoSaldos);

router.post("/:id/fechar", authorize("admin", "financeiro"), fecharBloco);

router.post("/:id/pedidos", authorize("admin", "financeiro", "vendedor"), addPedidoToBloco);
router.delete("/:id/pedidos/:pedido_id", authorize("admin", "financeiro"), unlinkPedido);

router.get("/:id/lancamentos", authorize("admin", "financeiro", "vendedor"), listLancamentosDoBloco);
router.post("/:id/lancamentos", authorize("admin", "financeiro"), addLancamentoToBloco);

router.get("/:id/pedidos", authorize("admin", "financeiro", "vendedor"), listPedidosDoBloco);

export default router;
