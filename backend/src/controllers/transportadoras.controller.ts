import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

/* ---------- utils ---------- */
const toDbNull = (v?: string | null) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;

/* ---------- schemas ---------- */
const transportadoraSchema = z.object({
  razao_social: z.string().min(1, "Razão Social é obrigatória"),
  cnpj: z.string().optional(),
  forma_envio: z.string().optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  referencia: z.string().optional(),
  ativo: z.boolean().default(true),
});

/* ---------- listagem com busca/paginação ---------- */
export const getTransportadoras = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 200);
    const search = String(req.query.search ?? "").trim();
    const offset = (page - 1) * limit;

    let where = "1=1";
    const reqList = pool.request();
    const reqCount = pool.request();

    if (search) {
      where += " AND (razao_social LIKE @s OR cnpj LIKE @s OR telefone LIKE @s)";
      reqList.input("s", `%${search}%`);
      reqCount.input("s", `%${search}%`);
    }

    const countSql = `SELECT COUNT(*) AS total FROM transportadoras WHERE ${where}`;
    const listSql = `
      SELECT *
      FROM transportadoras
      WHERE ${where}
      ORDER BY razao_social
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    reqList.input("offset", offset).input("limit", limit);
    const [countRs, listRs] = await Promise.all([
      reqCount.query(countSql),
      reqList.query(listSql),
    ]);

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
    const rs = await pool.request().input("id", +id)
      .query("SELECT * FROM transportadoras WHERE id = @id");
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

    const rs = await pool
      .request()
      .input("razao_social", d.razao_social)
      .input("cnpj", toDbNull(d.cnpj ?? null))
      .input("forma_envio", toDbNull(d.forma_envio ?? null))
      .input("telefone", toDbNull(d.telefone ?? null))
      .input("endereco", toDbNull(d.endereco ?? null))
      .input("referencia", toDbNull(d.referencia ?? null))
      .input("ativo", d.ativo ?? true)
      .query(`
        INSERT INTO transportadoras
          (razao_social, cnpj, forma_envio, telefone, endereco, referencia, ativo, criado_em)
        OUTPUT INSERTED.*
        VALUES
          (@razao_social, @cnpj, @forma_envio, @telefone, @endereco, @referencia, @ativo, SYSUTCDATETIME())
      `);

    res.status(201).json(rs.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if (error?.number === 2627) {
      return res.status(409).json({ message: "CNPJ já cadastrado." });
    }
    console.error("Erro ao criar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateTransportadora = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const d = transportadoraSchema.partial().parse(req.body);

    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(d)) {
      sanitized[k] =
        ["cnpj", "forma_envio", "telefone", "endereco", "referencia"].includes(k)
          ? toDbNull(v as any)
          : v;
    }

    const fields = Object.keys(sanitized).map((k) => `${k}=@${k}`).join(", ");
    if (!fields) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const reqDb = pool.request().input("id", +id);
    Object.entries(sanitized).forEach(([k, v]) => reqDb.input(k, v as any));

    const rs = await reqDb.query(`
      UPDATE transportadoras
         SET ${fields}, atualizado_em = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE id = @id
    `);

    if (!rs.recordset.length) return res.status(404).json({ message: "Transportadora não encontrada" });
    res.json(rs.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if (error?.number === 2627) {
      return res.status(409).json({ message: "CNPJ já cadastrado." });
    }
    console.error("Erro ao atualizar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteTransportadora = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rs = await pool.request().input("id", +id)
      .query("DELETE FROM transportadoras WHERE id = @id");
    if ((rs.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ message: "Transportadora não encontrada" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
