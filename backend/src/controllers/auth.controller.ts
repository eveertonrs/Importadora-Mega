import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

const registerSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  permissao: z.enum(["ADMIN", "USER"]).default("USER"),
});

export const login = async (req: Request, res: Response) => {
  try {
    console.log("Iniciando login...");
    const { email, senha } = loginSchema.parse(req.body);
    console.log("Email:", email);
    console.log("Senha:", senha);

    const result = await pool
      .request()
      .input("email", email)
      .query("SELECT id, nome, email, senha_hash, permissao FROM usuarios WHERE email = @email AND ativo = 1");

    console.log("Resultado da query:", result);

    if (result.recordset.length === 0) {
      console.log("Credenciais inválidas: Usuário não encontrado");
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const user = result.recordset[0];

    const isPasswordValid = await bcrypt.compare(senha, user.senha_hash);

    console.log("Senha válida:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Credenciais inválidas: Senha incorreta");
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        permissao: user.permissao,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1d",
      }
    );

    console.log("Token gerado:", token);

    res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        permissao: user.permissao,
      },
    });

    console.log("Login finalizado com sucesso!");
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log("Erro de validação:", error.errors);
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro no login:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const senha_hash = await bcrypt.hash(data.senha, 10);

    const result = await pool
      .request()
      .input("nome", data.nome)
      .input("email", data.email)
      .input("senha_hash", senha_hash)
      .input("permissao", data.permissao)
      .query(
        `INSERT INTO usuarios (nome, email, senha_hash, permissao)
         OUTPUT INSERTED.*
         VALUES (@nome, @email, @senha_hash, @permissao)`
      );

    res.status(201).json({
      message: "Usuário criado com sucesso!",
      user: result.recordset[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro no registro:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
