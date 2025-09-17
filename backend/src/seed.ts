// src/seed.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool, connectDB } from "./db";

const seedAdminUser = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@megasistemas.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin";
    const adminPermissao: "admin" = "admin"; // precisa ser minúsculo por causa do CHECK no banco

    // Verifica se já existe
    const userExists = await pool
      .request()
      .input("email", adminEmail)
      .query("SELECT id FROM usuarios WHERE email = @email");

    if (userExists.recordset.length > 0) {
      console.log("Usuário admin já existe. Seed não executado.");
      return;
    }

    // Cria o admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    await pool
      .request()
      .input("nome", "Administrador")
      .input("email", adminEmail)
      .input("senha_hash", hashedPassword)
      .input("permissao", adminPermissao) // <- minúsculo
      .query(
        `INSERT INTO usuarios (nome, email, senha_hash, permissao, ativo)
         VALUES (@nome, @email, @senha_hash, @permissao, 1)`
      );

    console.log(`Usuário admin criado com sucesso! Email: ${adminEmail}`);
  } catch (error) {
    console.error("Erro ao executar o seed do usuário admin:", error);
  } finally {
    // como é um script isolado, pode fechar o pool
    await pool.close();
    console.log("Conexão com o banco de dados fechada.");
  }
};

seedAdminUser();
