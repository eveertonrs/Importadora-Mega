import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getFormasPagamento, getFormaPagamentoById, createFormaPagamento, updateFormaPagamento, deleteFormaPagamento } from "../controllers/formasPagamento.controller";

const router = Router();

router.use(protect);

router.route("/")
  .get(getFormasPagamento)
  .post(createFormaPagamento);

router.route("/:id")
  .get(getFormaPagamentoById)
  .put(updateFormaPagamento)
  .delete(deleteFormaPagamento);

export default router;
