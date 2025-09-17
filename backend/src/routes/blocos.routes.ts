import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  createBloco,
  addPedidoToBloco,
  addLancamentoToBloco,
  getBlocoSaldo,
  fecharBloco,
} from "../controllers/blocos.controller";

const router = Router();

router.use(protect);

router.post("/", authorize("admin", "financeiro"), createBloco);

router.post("/:id/pedidos", authorize("admin", "financeiro", "vendedor"), addPedidoToBloco);

router.post("/:id/lancamentos", authorize("admin", "financeiro"), addLancamentoToBloco);

router.get("/:id/saldo", authorize("admin", "financeiro", "vendedor"), getBlocoSaldo);

router.post("/:id/fechar", authorize("admin", "financeiro"), fecharBloco);

export default router;
