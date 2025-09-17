import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import clientesRoutes from "./routes/clientes.routes";
import blocosRoutes from "./routes/blocos.routes";
import dominiosRoutes from "./routes/dominios.routes";
import transportadorasRoutes from "./routes/transportadoras.routes";
import fechamentosRoutes from "./routes/fechamentos.routes";
import chequesRoutes from "./routes/cheques.routes";
import { connectDB } from "./db";

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/auth", authRoutes);
app.use("/clientes", clientesRoutes);
app.use("/blocos", blocosRoutes);
app.use("/dominios", dominiosRoutes);
app.use("/transportadoras", transportadorasRoutes);
app.use("/fechamentos", fechamentosRoutes);
app.use("/cheques", chequesRoutes);

app.get("/", (_req, res) => res.send("API is running"));

connectDB();

const port = process.env.PORT || 3333;
app.listen(port, () => console.log(`API on :${port}`));

export default app;
