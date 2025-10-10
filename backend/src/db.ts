import "dotenv/config";
import sql from "mssql";

/**
 * Configuração do SQL Server (alinhada ao MSSQL 2016+).
 * Mantém opções via .env e adiciona timeouts razoáveis.
 */
export const dbConfig: sql.config = {
  server: process.env.MSSQL_SERVER!,
  database: process.env.MSSQL_DB!,
  user: process.env.MSSQL_USER!,
  password: process.env.MSSQL_PASSWORD!,
  options: {
    trustServerCertificate: (process.env.MSSQL_TRUST_CERT ?? "true") === "true",
    encrypt: (process.env.MSSQL_ENCRYPT ?? "false") === "true",
    enableArithAbort: true,
  },
  pool: {
    max: Number(process.env.MSSQL_POOL_MAX ?? 10),
    min: Number(process.env.MSSQL_POOL_MIN ?? 1),
    idleTimeoutMillis: Number(process.env.MSSQL_POOL_IDLE ?? 30000),
  },
  requestTimeout: Number(process.env.MSSQL_REQUEST_TIMEOUT ?? 30000),
  connectionTimeout: Number(process.env.MSSQL_CONN_TIMEOUT ?? 15000),
};

export const pool = new sql.ConnectionPool(dbConfig);

export const connectDB = async () => {
  try {
    await pool.connect();
    console.log("Conectado ao banco de dados com sucesso!");
  } catch (err) {
    console.error("Falha na conexão com o banco de dados:", err);
    process.exit(1);
  }
};

// log básico de erros no pool (evita processo “silencioso”)
pool.on("error", (err) => {
  console.error("[MSSQL pool error]", err);
});

export type MSSql = typeof sql;
export { sql };
