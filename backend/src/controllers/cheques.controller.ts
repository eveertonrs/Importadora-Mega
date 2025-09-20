import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  status: z.enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"]).optional(),
  cliente_id: z.coerce.number().int().optional(),
  bom_para_de: z.string().datetime().optional(),
  bom_para_ate: z.string().datetime().optional(),
  q: z.string().trim().optional(), // busca em numero_referencia / observacao
});

export const getCheques = async (req: Request, res: Response) => {
  try {
    const { page, limit, status, cliente_id, bom_para_de, bom_para_ate, q } =
      listQuerySchema.parse(req.query);
    const offset = (page - 1) * limit;

    const where: string[] = ["bl.tipo_recebimento = 'CHEQUE'"];
    const reqCount = pool.request();
    const reqPage = pool.request();

    if (status) {
      where.push("bl.status = @status");
      reqCount.input("status", status);
      reqPage.input("status", status);
    }
    if (cliente_id) {
      where.push("b.cliente_id = @cliente_id");
      reqCount.input("cliente_id", cliente_id);
      reqPage.input("cliente_id", cliente_id);
    }
    if (bom_para_de) {
      where.push("bl.bom_para >= @bom_para_de");
      reqCount.input("bom_para_de", bom_para_de);
      reqPage.input("bom_para_de", bom_para_de);
    }
    if (bom_para_ate) {
      where.push("bl.bom_para <= @bom_para_ate");
      reqCount.input("bom_para_ate", bom_para_ate);
      reqPage.input("bom_para_ate", bom_para_ate);
    }
    if (q) {
      where.push("(bl.numero_referencia LIKE '%' + @q + '%' OR bl.observacao LIKE '%' + @q + '%')");
      reqCount.input("q", q);
      reqPage.input("q", q);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*) AS total
        FROM bloco_lancamentos bl
        JOIN blocos b   ON bl.bloco_id = b.id
        JOIN clientes c ON b.cliente_id = c.id
      ${whereSql}
    `;

    const pageSql = `
      SELECT bl.*,
             c.nome_fantasia,
             b.cliente_id,
             b.codigo AS codigo_bloco
        FROM bloco_lancamentos bl
        JOIN blocos b   ON bl.bloco_id = b.id
        JOIN clientes c ON b.cliente_id = c.id
      ${whereSql}
      ORDER BY
        CASE WHEN bl.bom_para IS NULL THEN 1 ELSE 0 END,  -- nulos por último
        bl.bom_para ASC,
        bl.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    reqPage.input("offset", offset).input("limit", limit);

    const [countRs, pageRs] = await Promise.all([
      reqCount.query(countSql),
      reqPage.query(pageSql),
    ]);

    res.json({
      data: pageRs.recordset,
      total: Number(countRs.recordset[0]?.total ?? 0),
      page,
      limit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao buscar cheques:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

async function ensureCheque(id: number) {
  const rs = await pool
    .request()
    .input("id", id)
    .query(
      `SELECT id, status, tipo_recebimento
         FROM bloco_lancamentos
        WHERE id = @id`
    );
  const row = rs.recordset[0];
  if (!row) return { ok: false as const, error: "not_found" as const };
  if (row.tipo_recebimento !== "CHEQUE")
    return { ok: false as const, error: "not_cheque" as const };
  return { ok: true as const, row };
}

export const liquidarCheque = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const chk = await ensureCheque(id);
    if (!chk.ok) {
      if (chk.error === "not_found")
        return res.status(404).json({ message: "Lançamento não encontrado" });
      return res.status(400).json({ message: "Lançamento não é um CHEQUE" });
    }
    if (chk.row.status === "LIQUIDADO")
      return res.status(409).json({ message: "Cheque já liquidado" });
    if (chk.row.status === "CANCELADO")
      return res.status(409).json({ message: "Cheque cancelado" });

    const rs = await pool
      .request()
      .input("id", id)
      .query(`
        UPDATE bloco_lancamentos
           SET status = 'LIQUIDADO'
         OUTPUT INSERTED.*
         WHERE id = @id AND tipo_recebimento = 'CHEQUE'
      `);

    res.json(rs.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao liquidar cheque:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const devolverCheque = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const chk = await ensureCheque(id);
    if (!chk.ok) {
      if (chk.error === "not_found")
        return res.status(404).json({ message: "Lançamento não encontrado" });
      return res.status(400).json({ message: "Lançamento não é um CHEQUE" });
    }
    if (chk.row.status === "DEVOLVIDO")
      return res.status(409).json({ message: "Cheque já devolvido" });
    if (chk.row.status === "CANCELADO")
      return res.status(409).json({ message: "Cheque cancelado" });

    const rs = await pool
      .request()
      .input("id", id)
      .query(`
        UPDATE bloco_lancamentos
           SET status = 'DEVOLVIDO'
         OUTPUT INSERTED.*
         WHERE id = @id AND tipo_recebimento = 'CHEQUE'
      `);

    res.json(rs.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao devolver cheque:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
