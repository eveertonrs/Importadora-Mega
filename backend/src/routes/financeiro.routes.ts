import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  listTitulos,
  createTitulo,
  getTitulo,
  updateTitulo,
  deleteTitulo,
  registrarBaixa,
  listarBaixas,
  saldoCliente,
  conferenciaDiaria,
} from "../controllers/financeiro.controller";

const router = Router();

// todas as rotas protegidas
router.use(protect);

/**
 * TÍTULOS (cheque/boleto/etc.)
 */
router
  .route("/titulos")
  .get(authorize("admin", "financeiro"), listTitulos)   // filtros via query
  .post(authorize("admin", "financeiro"), createTitulo);

router
  .route("/titulos/:id")
  .get(authorize("admin", "financeiro"), getTitulo)     // (se quiser detalhar; se não tiver no controller, remove esta linha)
  .put(authorize("admin", "financeiro"), updateTitulo)
  .delete(authorize("admin", "financeiro"), deleteTitulo);

/**
 * BAIXAS de um título
 */
router
  .route("/titulos/:id/baixas")
  .get(authorize("admin", "financeiro"), listarBaixas)
  .post(authorize("admin", "financeiro"), registrarBaixa);

/**
 * SALDO em aberto por cliente
 */
router.get(
  "/clientes/:clienteId/saldo",
  authorize("admin", "financeiro"),
  saldoCliente
);

/**
 * CONFERÊNCIA diária (fechamento/relatório do dia)
 * ?data=YYYY-MM-DD&operador_id=&cliente_id=
 */
router.get(
  "/conferencia",
  authorize("admin", "financeiro"),
  conferenciaDiaria
);

export default router;
