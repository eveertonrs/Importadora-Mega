import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { getTransportadoras, getTransportadoraById, createTransportadora, updateTransportadora, deleteTransportadora } from "../controllers/transportadoras.controller";

const router = Router();

router.use(protect);

router.route("/")
  .get(getTransportadoras)
  .post(createTransportadora);

router.route("/:id")
  .get(getTransportadoraById)
  .put(updateTransportadora)
  .delete(deleteTransportadora);

export default router;
