import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { createBloco, addPedidoToBloco, addLancamentoToBloco, getBlocoSaldo, fecharBloco } from "../controllers/blocos.controller";

const router = Router();

router.use(protect);

router.post("/", createBloco);
router.post("/:id/pedidos", addPedidoToBloco);
router.post("/:id/lancamentos", addLancamentoToBloco);
router.get("/:id/saldo", getBlocoSaldo);
router.post("/:id/fechar", fecharBloco);

export default router;
