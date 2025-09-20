// src/routes/blocos.routes.ts
import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  createBloco,
  addPedidoToBloco,
  addLancamentoToBloco,
  getBlocoSaldo,
  fecharBloco,
  unlinkPedido,
  listBlocos,
  getBlocoById,
  listPedidosDoBloco,
  listLancamentosDoBloco,
} from "../controllers/blocos.controller";

const router = Router();

router.use(protect);

// listagem de blocos (com filtros/paginação)
router.get("/", authorize("admin", "financeiro", "vendedor"), listBlocos);

// cria bloco
router.post("/", authorize("admin", "financeiro"), createBloco);

// detalhe do bloco
router.get("/:id", authorize("admin", "financeiro", "vendedor"), getBlocoById);

// saldo do bloco
router.get("/:id/saldo", authorize("admin", "financeiro", "vendedor"), getBlocoSaldo);

// fechar bloco (somente saldo==0)
router.post("/:id/fechar", authorize("admin", "financeiro"), fecharBloco);

// vincula pedido ao bloco (aceita opcionalmente { valor_pedido })
router.post("/:id/pedidos", authorize("admin", "financeiro", "vendedor"), addPedidoToBloco);

// **Desvincula** pedido do bloco (ajuste no nome do param: :pedido_id)
router.delete("/:id/pedidos/:pedido_id", authorize("admin", "financeiro"), unlinkPedido);

// lançamentos do bloco
router.get("/:id/lancamentos", authorize("admin", "financeiro", "vendedor"), listLancamentosDoBloco);

// adiciona lançamento financeiro
router.post("/:id/lancamentos", authorize("admin", "financeiro"), addLancamentoToBloco);

// pedidos do bloco
router.get("/:id/pedidos", authorize("admin", "financeiro", "vendedor"), listPedidosDoBloco);

export default router;
