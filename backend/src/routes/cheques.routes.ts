import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getCheques, liquidarCheque, devolverCheque } from "../controllers/cheques.controller";

const router = Router();

router.use(protect);

router.get("/", getCheques);
router.post("/:id/liquidar", liquidarCheque);
router.post("/:id/devolver", devolverCheque);

export default router;
