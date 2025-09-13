import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool, connectDB } from "./db";

const runMigrations = async () => {
  try {
    await connectDB();
    console.log("Conectado ao banco de dados para migração.");

    const migrationsDir = path.join(__dirname, "../../db/migrations");
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
      if (file.endsWith(".sql")) {
        console.log(`Executando migração: ${file}`);
        const script = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        
        // Separa o script em lotes usando "GO"
        const batches = script.split(/^\s*GO\s*$/im);

        for (const batch of batches) {
          if (batch.trim() !== "") {
            await pool.request().batch(batch);
          }
        }
        console.log(`Migração ${file} executada com sucesso.`);
      }
    }

    console.log("Todas as migrações foram executadas.");
  } catch (error) {
    console.error("Erro ao executar migrações:", error);
  } finally {
    await pool.close();
    console.log("Conexão com o banco de dados fechada.");
  }
};

runMigrations();
