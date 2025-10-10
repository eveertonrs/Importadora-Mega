import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

/* ---------- utils ---------- */
const toDbNull = (v?: string | null) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;

const onlyDigits = (s?: string | null) =>
  s == null ? null : s.replace(/\D+/g, "") || null;

/* ---------- schemas ---------- */
const transportadoraSchema = z.object({
  razao_social: z.string().min(1, "Razão Social é obrigatória"),
  cnpj: z.string().nullish(),
  forma_envio: z.string().nullish(),
  telefone: z.string().nullish(),
  endereco: z.string().nullish(),
  referencia: z.string().nullish(),
  ativo: z.boolean().default(true),
});

/* ---------- listagem com busca/paginação ---------- */
export const getTransportadoras = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(Math.max(1, Number(req.query.limit ?? 20)), 200);
    const search = String(req.query.search ?? "").trim();
    const ativo = typeof req.query.ativo === "string" ? req.query.ativo.trim() : "";
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const reqList = pool.request();
    const reqCount = pool.request();

    if (search) {
      // usa IX_transportadoras_busca (razao_social) e IX_transportadoras_cnpj
      where.push("(razao_social LIKE @s OR cnpj LIKE @s OR telefone LIKE @s)");
      reqList.input("s", `%${search}%`);
      reqCount.input("s", `%${search}%`);
    }

    if (ativo === "1" || ativo.toUpperCase() === "TRUE") {
      where.push("ativo = 1");
    } else if (ativo === "0" || ativo.toUpperCase() === "FALSE") {
      where.push("ativo = 0");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS total FROM transportadoras ${whereSql}`;
    const listSql = `
      SELECT id, razao_social, cnpj, forma_envio, telefone, endereco, referencia, ativo
      FROM transportadoras
      ${whereSql}
      ORDER BY razao_social
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    reqList.input("offset", offset).input("limit", limit);
    const [countRs, listRs] = await Promise.all([reqCount.query(countSql), reqList.query(listSql)]);

    res.json({
      data: listRs.recordset,
      total: Number(countRs.recordset[0]?.total ?? 0),
      page,
      limit,
    });
  } catch (error) {
    console.error("Erro ao buscar transportadoras:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getTransportadoraById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rs = await pool
      .request()
      .input("id", +id)
      .query(
        "SELECT id, razao_social, cnpj, forma_envio, telefone, endereco, referencia, ativo FROM transportadoras WHERE id = @id"
      );
    if (!rs.recordset.length) return res.status(404).json({ message: "Transportadora não encontrada" });
    res.json(rs.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createTransportadora = async (req: Request, res: Response) => {
  try {
    const d = transportadoraSchema.parse(req.body);

    // normalizações leves (aderente ao que vínhamos fazendo)
    const cnpj = onlyDigits(d.cnpj ?? null);
    const telefone = onlyDigits(d.telefone ?? null);

    // como o índice de CNPJ não é único no DB, garantimos no app
    if (cnpj) {
      const dup = await pool
        .request()
        .input("cnpj", cnpj)
        .query("SELECT TOP 1 id FROM transportadoras WHERE cnpj = @cnpj");
      if (dup.recordset.length) {
        return res.status(409).json({ message: "CNPJ já cadastrado." });
      }
    }

    const rs = await pool
      .request()
      .input("razao_social", d.razao_social)
      .input("cnpj", toDbNull(cnpj))
      .input("forma_envio", toDbNull(d.forma_envio ?? null))
      .input("telefone", toDbNull(telefone))
      .input("endereco", toDbNull(d.endereco ?? null))
      .input("referencia", toDbNull(d.referencia ?? null))
      .input("ativo", d.ativo ?? true)
      .query(`
        INSERT INTO transportadoras
          (razao_social, cnpj, forma_envio, telefone, endereco, referencia, ativo)
        OUTPUT INSERTED.id, INSERTED.razao_social, INSERTED.cnpj, INSERTED.forma_envio, INSERTED.telefone,
               INSERTED.endereco, INSERTED.referencia, INSERTED.ativo
        VALUES
          (@razao_social, @cnpj, @forma_envio, @telefone, @endereco, @referencia, @ativo)
      `);

    res.status(201).json(rs.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar transportadora:", error);
    res.status(500).json({
      message: "Erro interno no servidor",
      detail: error?.message ?? undefined,
      code: error?.number ?? undefined,
    });
  }
};

export const updateTransportadora = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const d = transportadoraSchema.partial().parse(req.body);

    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(d)) {
      if (k === "cnpj") sanitized.cnpj = toDbNull(onlyDigits(v as string | null));
      else if (k === "telefone") sanitized.telefone = toDbNull(onlyDigits(v as string | null));
      else if (["forma_envio", "endereco", "referencia"].includes(k)) sanitized[k] = toDbNull(v as any);
      else sanitized[k] = v;
    }

    // checagem de duplicidade de CNPJ quando alterado
    if (sanitized.cnpj) {
      const dup = await pool
        .request()
        .input("cnpj", sanitized.cnpj)
        .input("id", +id)
        .query("SELECT TOP 1 id FROM transportadoras WHERE cnpj = @cnpj AND id <> @id");
      if (dup.recordset.length) {
        return res.status(409).json({ message: "CNPJ já cadastrado." });
      }
    }

    const fields = Object.keys(sanitized)
      .map((k) => `${k} = @${k}`)
      .join(", ");
    if (!fields) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const reqDb = pool.request().input("id", +id);
    Object.entries(sanitized).forEach(([k, v]) => reqDb.input(k, v as any));

    const rs = await reqDb.query(`
      UPDATE transportadoras
         SET ${fields}
       OUTPUT INSERTED.id, INSERTED.razao_social, INSERTED.cnpj, INSERTED.forma_envio, INSERTED.telefone,
              INSERTED.endereco, INSERTED.referencia, INSERTED.ativo
       WHERE id = @id
    `);

    if (!rs.recordset.length) return res.status(404).json({ message: "Transportadora não encontrada" });
    res.json(rs.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao atualizar transportadora:", error);
    res.status(500).json({
      message: "Erro interno no servidor",
      detail: error?.message ?? undefined,
      code: error?.number ?? undefined,
    });
  }
};

export const deleteTransportadora = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rs = await pool.request().input("id", +id).query("DELETE FROM transportadoras WHERE id = @id");
    if ((rs.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ message: "Transportadora não encontrada" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
