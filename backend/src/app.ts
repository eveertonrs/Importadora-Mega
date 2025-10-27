import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
// import morgan from "morgan";

import authRoutes from "./routes/auth.routes";
import clientesRoutes from "./routes/clientes.routes";
import blocosRoutes from "./routes/blocos.routes";
import dominiosRoutes from "./routes/dominios.routes";
import transportadorasRoutes from "./routes/transportadoras.routes";
import fechamentosRoutes from "./routes/fechamentos.routes";
import chequesRoutes from "./routes/cheques.routes";
import formasPagamentoRoutes from "./routes/formasPagamento.routes";
import pagamentosRoutes from "./routes/pagamentos.routes";
import pedidoParametrosRoutes from "./routes/pedidoParametros.routes";
import financeiroRoutes from "./routes/financeiro.routes";
import usuariosRoutes from "./routes/usuarios.routes";

import { connectDB } from "./db";

const app = express();

/* ---------- config ---------- */
const API_PREFIX = (process.env.API_PREFIX || "/api").replace(/\/+$/, ""); // default: /api

/* ---------- middlewares básicos ---------- */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
      : true, // libera tudo em dev; configure CORS_ORIGIN em prod
    credentials: false,
  })
);
// app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

/* ---------- rotas públicas simples ---------- */
app.get("/", (_req, res) => res.send("API is running"));
app.get(`${API_PREFIX}/healthz`, (_req, res) => res.status(200).json({ status: "ok" }));
app.get(`${API_PREFIX}/ready`, (_req, res) => res.status(200).json({ ready: true }));

/* ---------- rotas da aplicação (todas sob /api) ---------- */
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/clientes`, clientesRoutes);
app.use(`${API_PREFIX}/blocos`, blocosRoutes);
app.use(`${API_PREFIX}/dominios`, dominiosRoutes);
app.use(`${API_PREFIX}/transportadoras`, transportadorasRoutes);
app.use(`${API_PREFIX}/fechamentos`, fechamentosRoutes);
app.use(`${API_PREFIX}/cheques`, chequesRoutes);
app.use(`${API_PREFIX}/pagamentos/formas`, formasPagamentoRoutes);
app.use(`${API_PREFIX}/pagamentos`, pagamentosRoutes);
app.use(`${API_PREFIX}/pedido-parametros`, pedidoParametrosRoutes);
app.use(`${API_PREFIX}/financeiro`, financeiroRoutes);
app.use(`${API_PREFIX}/usuarios`, usuariosRoutes);

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).json({
    message: "Rota não encontrada",
    path: req.originalUrl,
    method: req.method,
  });
});

/* ---------- error handler ---------- */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || err?.statusCode || 500;
  if (err?.name === "ZodError") {
    return res.status(400).json({ message: "Erro de validação", errors: err.errors });
  }
  console.error("Unhandled error:", err);
  res.status(status).json({ message: err?.message || "Erro interno no servidor" });
});

/* ---------- bootstrap ---------- */
const port = Number(process.env.PORT || 4010);

async function start() {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`API on :${port} (prefix ${API_PREFIX})`);
    });
  } catch (e) {
    console.error("Falha ao iniciar a API:", e);
    process.exit(1);
  }
}

void start();

export default app;
