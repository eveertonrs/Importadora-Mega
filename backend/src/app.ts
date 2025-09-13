import express from "express";
import cors from "cors";
import morgan from "morgan";
import { protect } from "./middleware/auth.middleware";
import authRoutes from "./routes/auth.routes";
import clientesRoutes from "./routes/clientes.routes";
import blocosRoutes from "./routes/blocos.routes";
import dominiosRoutes from "./routes/dominios.routes";
import transportadorasRoutes from "./routes/transportadoras.routes";
import fechamentosRoutes from "./routes/fechamentos.routes";
import chequesRoutes from "./routes/cheques.routes";
import pagamentosRoutes from "./routes/pagamentos.routes";
import formasPagamentoRoutes from "./routes/formasPagamento.routes";
import transportadorasRoutes_1 from "./routes/transportadoras.routes";
import { pool, connectDB } from "./db";

const app = express();

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rotas
app.use("/auth", authRoutes);
app.use("/clientes", protect, clientesRoutes);
app.use("/blocos", protect, blocosRoutes);
app.use("/dominios", protect, dominiosRoutes);
app.use("/transportadoras", protect, transportadorasRoutes_1);
app.use("/fechamentos", protect, fechamentosRoutes);
app.use("/cheques", protect, chequesRoutes);
app.use("/pagamentos", protect, pagamentosRoutes);
app.use("/formas-pagamento", protect, formasPagamentoRoutes);

// Rota padrão
app.get("/", (req, res) => {
  res.send("API is running");
});

connectDB();

const port = process.env.PORT || 3333;

app.listen(port, () => {
  console.log(`API on :${port}`);
});

export default app;
