import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";

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

import { connectDB } from "./db";

const app = express();

/* ---------- middlewares básicos ---------- */
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

/* ---------- rotas públicas simples ---------- */
app.get("/", (_req, res) => res.send("API is running"));
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", (_req, res) => res.status(200).json({ ready: true }));

/* ---------- rotas da aplicação ---------- */
app.use("/auth", authRoutes);
app.use("/clientes", clientesRoutes);
app.use("/blocos", blocosRoutes);
app.use("/dominios", dominiosRoutes);
app.use("/transportadoras", transportadorasRoutes);
app.use("/fechamentos", fechamentosRoutes);
app.use("/cheques", chequesRoutes);
app.use("/pagamentos/formas", formasPagamentoRoutes);
app.use("/pagamentos", pagamentosRoutes);
app.use("/pedido-parametros", pedidoParametrosRoutes);
app.use("/financeiro", financeiroRoutes);


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
const port = Number(process.env.PORT || 3333);

async function start() {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`API on :${port}`);
    });
  } catch (e) {
    console.error("Falha ao iniciar a API:", e);
    process.exit(1);
  }
}

void start();

export default app;
