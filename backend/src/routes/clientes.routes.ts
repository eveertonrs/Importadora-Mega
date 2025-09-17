import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  createClienteDocumento,
  updateClienteDocumento,
  deleteClienteDocumento,
} from "../controllers/clientes.controller";

const router = Router();

router.use(protect);

router
  .route("/")
  .get(authorize("admin", "financeiro", "vendedor"), getClientes)
  .post(authorize("admin", "financeiro"), createCliente);

router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor"), getClienteById)
  .put(authorize("admin", "financeiro"), updateCliente)
  .delete(authorize("admin"), deleteCliente);

router
  .route("/:cliente_id/documentos")
  .post(authorize("admin", "financeiro"), createClienteDocumento);

router
  .route("/:cliente_id/documentos/:id")
  .put(authorize("admin", "financeiro"), updateClienteDocumento)
  .delete(authorize("admin", "financeiro"), deleteClienteDocumento);

export default router;
