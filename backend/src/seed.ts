import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool, connectDB } from "./db";

const seedAdminUser = async () => {
  try {
    await connectDB();

    const adminEmail = "admin@megasistemas.com";

    // Verifica se o usuário já existe
    const userExists = await pool
      .request()
      .input("email", adminEmail)
      .query("SELECT id FROM usuarios WHERE email = @email");

    if (userExists.recordset.length > 0) {
      console.log("Usuário admin já existe. Seed não executado.");
      return;
    }

    // Cria o usuário admin se não existir
    const password = "admin"; // Senha padrão para o ambiente de dev
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool
      .request()
      .input("nome", "Administrador")
      .input("email", adminEmail)
      .input("senha_hash", hashedPassword)
      .input("permissao", "ADMIN")
      .query(
        "INSERT INTO usuarios (nome, email, senha_hash, permissao, ativo) VALUES (@nome, @email, @senha_hash, @permissao, 1)"
      );

    console.log("Usuário admin criado com sucesso!");
  } catch (error) {
    console.error("Erro ao executar o seed do usuário admin:", error);
  } finally {
    await pool.close();
    console.log("Conexão com o banco de dados fechada.");
  }
};

seedAdminUser();
