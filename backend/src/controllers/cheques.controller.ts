import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const getChequesSchema = z.object({
  status: z.enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"]).optional(),
});

export const getCheques = async (req: Request, res: Response) => {
  try {
    const { status } = getChequesSchema.parse(req.query);

    let query = `
      SELECT bl.*, c.nome_fantasia, b.cliente_id, b.codigo AS codigo_bloco
      FROM bloco_lancamentos bl
      JOIN blocos b ON bl.bloco_id = b.id
      JOIN clientes c ON b.cliente_id = c.id
      WHERE bl.tipo_recebimento = 'CHEQUE'
    `;

    const request = pool.request();
    if (status) {
      query += " AND bl.status = @status";
      request.input("status", status);
    }

    query += " ORDER BY bl.bom_para ASC";

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao buscar cheques:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const liquidarCheque = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", +id)
      .query(`
        UPDATE bloco_lancamentos
        SET status = 'LIQUIDADO'
        OUTPUT INSERTED.*
        WHERE id = @id AND tipo_recebimento = 'CHEQUE'
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Lançamento de cheque não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao liquidar cheque:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const devolverCheque = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", +id)
      .query(`
        UPDATE bloco_lancamentos
        SET status = 'DEVOLVIDO'
        OUTPUT INSERTED.*
        WHERE id = @id AND tipo_recebimento = 'CHEQUE'
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Lançamento de cheque não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao devolver cheque:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
