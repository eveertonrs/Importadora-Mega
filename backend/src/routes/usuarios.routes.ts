import { Router } from "express";
import { protect, authorize } from "../middleware/auth.middleware";
import {
  listUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  setAtivoUsuario,
  resetPasswordUsuario,
  deleteUsuario,
} from "../controllers/usuarios.controller";

const router = Router();

// somente admin gerencia usuários
router.use(protect, authorize("admin"));

/** GET   /api/usuarios */
router.get("/", listUsuarios);
/** GET   /api/usuarios/:id */
router.get("/:id", getUsuarioById);
/** POST  /api/usuarios */
router.post("/", createUsuario);
/** PUT   /api/usuarios/:id */
router.put("/:id", updateUsuario);

/** PATCH /api/usuarios/:id/ativo    { ativo: true|false } */
router.patch("/:id/ativo", setAtivoUsuario);
/** PATCH /api/usuarios/:id/toggle   (sem body) */
router.patch("/:id/toggle", setAtivoUsuario); // o controller trata toggle quando body.ativo não vier

/** POST  /api/usuarios/:id/reset-password { senha?: string } */
router.post("/:id/reset-password", resetPasswordUsuario);
/** DELETE /api/usuarios/:id */
router.delete("/:id", deleteUsuario);

export default router;
