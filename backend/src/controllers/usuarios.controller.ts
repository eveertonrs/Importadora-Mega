import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db";
import type { Permissao, AuthenticatedRequest } from "../middleware/auth.middleware";

/* ============== Schemas ============== */

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional().default(""),
  ativo: z.enum(["all", "1", "0"]).default("all"),
  permissao: z.enum(["all", "admin", "financeiro", "vendedor", "administrativo"]).default("all"),
});

const upsertSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  permissao: z.enum(["admin", "financeiro", "vendedor", "administrativo"]),
  ativo: z.boolean(),
  senha: z.string().min(6).optional().or(z.literal("")),
});

const createSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  permissao: z.enum(["admin", "financeiro", "vendedor", "administrativo"]).default("administrativo"),
  senha: z.string().min(6),
});

const resetSchema = z.object({
  senha: z.string().min(6).optional(), // se não vier, gera aleatória
});

/* ============== Helpers ============== */

function randomPassword(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/* ============== Listar ============== */

export const listUsuarios = async (req: Request, res: Response) => {
  try {
    const { page, limit, search, ativo, permissao } = listQuerySchema.parse(req.query);

    const whereParts: string[] = [];
    const params: Record<string, any> = {};

    if (search) {
      whereParts.push("(u.nome LIKE ('%' + @search + '%') OR u.email LIKE ('%' + @search + '%'))");
      params.search = search;
    }
    if (ativo !== "all") {
      whereParts.push("u.ativo = @ativo");
      params.ativo = ativo === "1" ? 1 : 0;
    }
    if (permissao !== "all") {
      whereParts.push("LOWER(u.permissao) = @permissao");
      params.permissao = permissao;
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    // total
    let reqCount = pool.request();
    for (const [k, v] of Object.entries(params)) reqCount = reqCount.input(k, v);
    const countSql = `SELECT COUNT(1) AS total FROM usuarios u ${where}`;
    const total = (await reqCount.query(countSql)).recordset[0]?.total ?? 0;

    // page
    let reqPage = pool.request();
    for (const [k, v] of Object.entries(params)) reqPage = reqPage.input(k, v);
    reqPage = reqPage.input("limit", limit).input("offset", offset);

    const pageSql = `
      SELECT u.id, u.nome, u.email, LOWER(u.permissao) AS permissao, u.ativo, u.criado_em
      FROM usuarios u
      ${where}
      ORDER BY u.nome ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    const rows = (await reqPage.query(pageSql)).recordset;

    res.json({
      data: rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        email: r.email,
        permissao: r.permissao as Permissao,
        ativo: Boolean(r.ativo),
        criado_em: r.criado_em,
      })),
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Parâmetros inválidos", errors: e.errors });
    }
    console.error("listUsuarios error:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ============== Obter por ID ============== */

export const getUsuarioById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

    const r = await pool
      .request()
      .input("id", id)
      .query(
        "SELECT id, nome, email, LOWER(permissao) AS permissao, ativo, criado_em FROM usuarios WHERE id = @id"
      );
    if (r.recordset.length === 0) return res.status(404).json({ message: "Usuário não encontrado" });

    const u = r.recordset[0];
    res.json({
      id: u.id,
      nome: u.nome,
      email: u.email,
      permissao: u.permissao,
      ativo: Boolean(u.ativo),
      criado_em: u.criado_em,
    });
  } catch (e) {
    console.error("getUsuarioById error:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ============== Criar ============== */

export const createUsuario = async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const exists = await pool.request().input("email", email).query("SELECT 1 FROM usuarios WHERE email = @email");
    if (exists.recordset.length > 0) {
      return res.status(409).json({ message: "Email já cadastrado" });
    }

    const senha_hash = await bcrypt.hash(data.senha, 10);

    const rs = await pool
      .request()
      .input("nome", data.nome)
      .input("email", email)
      .input("senha_hash", senha_hash)
      .input("permissao", data.permissao.toLowerCase())
      .query(
        `INSERT INTO usuarios (nome, email, senha_hash, permissao, ativo)
         OUTPUT INSERTED.id, INSERTED.nome, INSERTED.email, LOWER(INSERTED.permissao) AS permissao, INSERTED.ativo, INSERTED.criado_em
         VALUES (@nome, @email, @senha_hash, @permissao, 1)`
      );

    const u = rs.recordset[0];
    res.status(201).json({
      id: u.id,
      nome: u.nome,
      email: u.email,
      permissao: u.permissao as Permissao,
      ativo: !!u.ativo,
      criado_em: u.criado_em,
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
    }
    if (e?.number === 2627 || e?.number === 2601) {
      return res.status(409).json({ message: "Email já cadastrado" });
    }
    console.error("createUsuario error:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ============== Atualizar ============== */

export const updateUsuario = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

    const data = upsertSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const exists = await pool
      .request()
      .input("id", id)
      .input("email", email)
      .query("SELECT 1 FROM usuarios WHERE email = @email AND id <> @id");
    if (exists.recordset.length > 0) {
      return res.status(409).json({ message: "Email já cadastrado" });
    }

    const sets: string[] = ["nome = @nome", "email = @email", "permissao = @permissao", "ativo = @ativo"];
    let reqUpd = pool
      .request()
      .input("id", id)
      .input("nome", data.nome)
      .input("email", email)
      .input("permissao", data.permissao.toLowerCase())
      .input("ativo", data.ativo ? 1 : 0);

    if (data.senha && data.senha.trim()) {
      const hash = await bcrypt.hash(data.senha, 10);
      sets.push("senha_hash = @senha_hash");
      reqUpd = reqUpd.input("senha_hash", hash);
    }

    const sql = `
      UPDATE usuarios SET ${sets.join(", ")} WHERE id = @id;
      SELECT id, nome, email, LOWER(permissao) AS permissao, ativo, criado_em FROM usuarios WHERE id = @id;
    `;
    const result = await reqUpd.query(sql);
    const u = result.recordset[0];

    res.json({
      message: "Usuário atualizado",
      user: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        permissao: u.permissao as Permissao,
        ativo: Boolean(u.ativo),
        criado_em: u.criado_em,
      },
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
    }
    console.error("updateUsuario error:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ============== Ativar/Inativar / Toggle ============== */

export const setAtivoUsuario = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

    // Se vier body.ativo usamos; senão, faremos toggle
    const body = z.object({ ativo: z.boolean().optional() }).parse(req.body);

    // Buscar estado/permissão atuais
    const cur = await pool
      .request()
      .input("id", id)
      .query("SELECT LOWER(permissao) AS permissao, ativo FROM usuarios WHERE id=@id");

    if (!cur.recordset.length) return res.status(404).json({ message: "Usuário não encontrado" });

    let novoAtivo = typeof body.ativo === "boolean" ? (body.ativo ? 1 : 0) : cur.recordset[0].ativo ? 0 : 1;

    // se vamos desativar admin, checar “último admin”
    if (novoAtivo === 0 && cur.recordset[0].permissao === "admin") {
      const admins = await pool
        .request()
        .query("SELECT COUNT(1) AS qty FROM usuarios WHERE LOWER(permissao)='admin' AND ativo=1");
      if (Number(admins.recordset[0]?.qty ?? 0) <= 1) {
        return res.status(400).json({ message: "Não é possível inativar o último admin ativo" });
      }
    }

    const rs = await pool
      .request()
      .input("id", id)
      .input("ativo", novoAtivo)
      .query(
        `UPDATE usuarios SET ativo=@ativo
         OUTPUT INSERTED.id, INSERTED.nome, INSERTED.email, LOWER(INSERTED.permissao) AS permissao, INSERTED.ativo, INSERTED.criado_em
         WHERE id=@id`
      );

    const u = rs.recordset[0];
    res.json({
      id: u.id,
      nome: u.nome,
      email: u.email,
      permissao: u.permissao as Permissao,
      ativo: !!u.ativo,
      criado_em: u.criado_em,
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados inválidos", errors: e.errors });
    }
    console.error("setAtivoUsuario error:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ============== Reset de Senha ============== */

export const resetPasswordUsuario = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

    if (!req.user || req.user.permissao !== "admin") {
      return res.status(403).json({ message: "Apenas admin pode resetar senha" });
    }

    const { senha } = resetSchema.parse(req.body);
    const nova = senha && senha.trim().length >= 6 ? senha : randomPassword(10);
    const senha_hash = await bcrypt.hash(nova, 10);

    const rs = await pool
      .request()
      .input("id", id)
      .input("senha_hash", senha_hash)
      .query(`UPDATE usuarios SET senha_hash=@senha_hash OUTPUT INSERTED.id WHERE id=@id`);

    if (!rs.recordset.length) return res.status(404).json({ message: "Usuário não encontrado" });

    res.json({ message: "Senha redefinida", senha_temporaria: senha ? undefined : nova });
  } catch (e) {
    console.error("resetPasswordUsuario error:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ============== Excluir ============== */

export const deleteUsuario = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID inválido" });

    if (req.user?.id === id) {
      return res.status(400).json({ message: "Você não pode excluir o próprio usuário" });
    }

    const alvo = await pool
      .request()
      .input("id", id)
      .query("SELECT id, LOWER(permissao) AS permissao FROM usuarios WHERE id=@id");
    if (!alvo.recordset.length) return res.status(404).json({ message: "Usuário não encontrado" });

    if (alvo.recordset[0].permissao === "admin") {
      const admins = await pool
        .request()
        .query("SELECT COUNT(1) AS qty FROM usuarios WHERE LOWER(permissao)='admin' AND ativo=1");
      if (Number(admins.recordset[0]?.qty ?? 0) <= 1) {
        return res.status(400).json({ message: "Não é possível excluir o último admin ativo" });
      }
    }

    try {
      const del = await pool.request().input("id", id).query("DELETE FROM usuarios OUTPUT DELETED.id WHERE id=@id");
      if (!del.recordset.length) return res.status(404).json({ message: "Usuário não encontrado" });
      res.json({ message: "Usuário excluído" });
    } catch (err: any) {
      if (err?.number === 547) {
        return res.status(409).json({
          message:
            "Não foi possível excluir: há registros relacionados a este usuário (ex.: lançamentos de bloco). Inative-o ou transfira a autoria antes de excluir.",
          code: "USUARIO_COM_REFERENCIAS",
        });
      }
      throw err;
    }
  } catch (e) {
    console.error("deleteUsuario error:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
