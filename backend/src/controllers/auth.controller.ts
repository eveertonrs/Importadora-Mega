import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db";
import type { Permissao, AuthenticatedRequest } from "../middleware/auth.middleware";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

const registerSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  permissao: z.enum(["admin", "financeiro", "vendedor"]).default("vendedor"),
});

function signToken(payload: { id: number; nome: string; permissao: Permissao }) {
  const secret = process.env.JWT_SECRET as string;
  if (!secret) {
    throw new Error("Configuração inválida do servidor (JWT_SECRET)");
  }
  return jwt.sign(payload, secret, { expiresIn: "1d" });
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);

    const result = await pool
      .request()
      .input("email", email)
      .query(
        "SELECT id, nome, email, senha_hash, permissao FROM usuarios WHERE email = @email AND ativo = 1"
      );

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    const user = result.recordset[0];
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ message: "Credenciais inválidas" });

    const permissao = (user.permissao as string).toLowerCase() as Permissao;
    const token = signToken({ id: user.id, nome: user.nome, permissao });

    res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        permissao,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro no login:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();

    // verifica se já existe
    const exists = await pool.request().input("email", email)
      .query("SELECT 1 FROM usuarios WHERE email = @email");
    if (exists.recordset.length > 0) {
      return res.status(409).json({ message: "Email já cadastrado" });
    }

    const senha_hash = await bcrypt.hash(data.senha, 10);
    const permissao = data.permissao.toLowerCase() as Permissao;

    const result = await pool
      .request()
      .input("nome", data.nome)
      .input("email", email)
      .input("senha_hash", senha_hash)
      .input("permissao", permissao)
      .query(
        `INSERT INTO usuarios (nome, email, senha_hash, permissao, ativo)
         OUTPUT INSERTED.id, INSERTED.nome, INSERTED.email, INSERTED.permissao
         VALUES (@nome, @email, @senha_hash, @permissao, 1)`
      );

    res.status(201).json({
      message: "Usuário criado com sucesso!",
      user: result.recordset[0],
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if (error?.number === 2627 || error?.number === 2601) {
      return res.status(409).json({ message: "Email já cadastrado" });
    }
    console.error("Erro no registro:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const me = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Acesso não autorizado" });
  try {
    const result = await pool
      .request()
      .input("id", req.user.id)
      .query("SELECT id, nome, email, permissao, ativo FROM usuarios WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const u = result.recordset[0];
    res.json({
      id: u.id,
      nome: u.nome,
      email: u.email,
      permissao: (u.permissao as string).toLowerCase() as Permissao,
      ativo: Boolean(u.ativo),
    });
  } catch (error) {
    console.error("Erro em /auth/me:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
