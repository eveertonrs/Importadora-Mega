import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";

// importe tudo do controller principal como namespace
import * as clientesCtrl from "../controllers/clientes.controller";
// e os handlers específicos de transportadoras<->clientes
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
  .get(authorize("admin", "financeiro", "vendedor"), clientesCtrl.getClientes)
  .post(authorize("admin", "financeiro"), clientesCtrl.createCliente);

router
  .route("/:id")
  .get(authorize("admin", "financeiro", "vendedor"), clientesCtrl.getClienteById)
  .put(authorize("admin", "financeiro"), clientesCtrl.updateCliente)
  .delete(authorize("admin"), clientesCtrl.deleteCliente);

/** Saldo isolado (usado pelo ClienteDetalhes.tsx) */
router.get(
  "/:id/saldo",
  authorize("admin", "financeiro", "vendedor"),
  clientesCtrl.getClienteSaldo
);

/** Vinculação de transportadoras (múltiplas por cliente) */
router
  .route("/:id/transportadoras")
  .get(authorize("admin", "financeiro", "vendedor"), listarTransportadorasDoCliente)
  .post(authorize("admin", "financeiro"), vincularTransportadora);

router
  .route("/:id/transportadoras/:tid")
  .patch(authorize("admin", "financeiro"), atualizarVinculo)
  .delete(authorize("admin", "financeiro"), removerVinculo);

/** Documentos & links do cliente */
router
  .route("/:cliente_id/documentos")
  .get(authorize("admin", "financeiro", "vendedor"), clientesCtrl.listClienteDocumentos)
  .post(authorize("admin", "financeiro"), clientesCtrl.createClienteDocumento);

router
  .route("/:cliente_id/documentos/:id")
  .put(authorize("admin", "financeiro"), clientesCtrl.updateClienteDocumento)
  .delete(authorize("admin", "financeiro"), clientesCtrl.deleteClienteDocumento);

export default router;
