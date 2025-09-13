import "dotenv/config";
import sql from "mssql";

const cfg: sql.config = {
  server: process.env.MSSQL_SERVER!,
  database: process.env.MSSQL_DB!,
  user: process.env.MSSQL_USER!,
  password: process.env.MSSQL_PASSWORD!,
  options: {
    trustServerCertificate: (process.env.MSSQL_TRUST_CERT ?? "true") === "true",
    encrypt: (process.env.MSSQL_ENCRYPT ?? "false") === "true",
  },
};

export const pool = new sql.ConnectionPool(cfg);

export const connectDB = async () => {
  try {
    await pool.connect();
    console.log("Conectado ao banco de dados com sucesso!");
  } catch (err) {
    console.error("Falha na conexão com o banco de dados:", err);
    process.exit(1);
  }
};
