import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getClientes, getClienteById, createCliente, updateCliente, deleteCliente, createClienteDocumento, updateClienteDocumento, deleteClienteDocumento } from "../controllers/clientes.controller";

const router = Router();

router.use(protect);

router.route("/")
  .get(getClientes)
  .post(createCliente);

router.route("/:id")
  .get(getClienteById)
  .put(updateCliente)
  .delete(deleteCliente);

router
  .route("/:cliente_id/documentos")
  .post(createClienteDocumento);

router
  .route("/:cliente_id/documentos/:id")
  .put(updateClienteDocumento)
  .delete(deleteClienteDocumento);

export default router;
