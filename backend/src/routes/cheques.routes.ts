import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import { getCheques, liquidarCheque, devolverCheque } from "../controllers/cheques.controller";

const router = Router();

router.use(protect);

// GET /cheques?status=&cliente_id=&bom_para_de=&bom_para_ate=&q=&page=&limit=
router.get("/", authorize("admin", "financeiro"), getCheques);

router.post("/:id/liquidar", authorize("admin", "financeiro"), liquidarCheque);
router.post("/:id/devolver", authorize("admin", "financeiro"), devolverCheque);

export default router;
