import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  listClienteDocumentos,
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

// documentos & links
router
  .route("/:cliente_id/documentos")
  .get(authorize("admin", "financeiro", "vendedor"), listClienteDocumentos)
  .post(authorize("admin", "financeiro"), createClienteDocumento);

router
  .route("/:cliente_id/documentos/:id")
  .put(authorize("admin", "financeiro"), updateClienteDocumento)
  .delete(authorize("admin", "financeiro"), deleteClienteDocumento);

export default router;
