import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";

// controller principal
import * as clientesCtrl from "../controllers/clientes.controller";
// handlers granulares de transportadoras<->clientes
import {
  listarDoCliente as listarTransportadorasDoCliente,
  vincular as vincularTransportadora,
  atualizar as atualizarVinculo,
  remover as removerVinculo,
} from "../controllers/clientesTransportadoras.controller";

const router = Router();
router.use(protect);

/** CRUD + busca */
router
  .route("/")
  .get(authorize("admin", "financeiro", "vendedor", "administrativo"), clientesCtrl.getClientes)
  .post(authorize("admin", "financeiro", "administrativo"), clientesCtrl.createCliente);

router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor", "administrativo"), clientesCtrl.getClienteById)
  .put(authorize("admin", "financeiro", "administrativo"), clientesCtrl.updateCliente)
  // excluir cliente: apenas admin
  .delete(authorize("admin"), clientesCtrl.deleteCliente);

/** Saldo isolado */
router.get(
  "/:id/saldo",
  authorize("admin", "financeiro", "vendedor", "administrativo"),
  clientesCtrl.getClienteSaldo
);

/** Transportadoras (granular) */
router
  .route("/:id/transportadoras")
  .get(authorize("admin", "financeiro", "vendedor", "administrativo"), listarTransportadorasDoCliente)
  .post(authorize("admin", "financeiro", "administrativo"), vincularTransportadora);

router
  .route("/:id/transportadoras/:tid")
  .patch(authorize("admin", "financeiro", "administrativo"), atualizarVinculo)
  // remover vínculo (exclusão): apenas admin
  .delete(authorize("admin"), removerVinculo);

/** Documentos & links do cliente */
router
  .route("/:cliente_id/documentos")
  .get(authorize("admin", "financeiro", "vendedor", "administrativo"), clientesCtrl.listClienteDocumentos)
  .post(authorize("admin", "financeiro", "administrativo"), clientesCtrl.createClienteDocumento);

router
  .route("/:cliente_id/documentos/:id")
  .put(authorize("admin", "financeiro", "administrativo"), clientesCtrl.updateClienteDocumento)
  // exclusão de documento: apenas admin
  .delete(authorize("admin"), clientesCtrl.deleteClienteDocumento);

export default router;
