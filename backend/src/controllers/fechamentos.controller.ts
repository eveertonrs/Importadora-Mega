import { Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import sql from "mssql";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido. Use YYYY-MM-DD");

export const createFechamento = async (req: AuthenticatedRequest, res: Response) => {
  const { data_ref } = req.params;
  const userId = req.user!.id;

  try {
    const validatedDate = dateSchema.parse(data_ref);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1) cria cabeçalho
      await new sql.Request(transaction)
        .input("data_ref", validatedDate)
        .input("criado_por", userId)
        .input("observacao", null)
        .query(`
          INSERT INTO fechamento_dia (data_ref, criado_por, criado_em, observacao)
          VALUES (@data_ref, @criado_por, SYSUTCDATETIME(), @observacao)
        `);

      // 2) captura lançamentos do dia
      const lancamentosDoDia = await new sql.Request(transaction)
        .input("data_ref", validatedDate)
        .query(`
          SELECT id, status
          FROM bloco_lancamentos
          WHERE CONVERT(date, data_lancamento) = @data_ref
        `);

      // 3) insere itens com status do momento
      for (const l of lancamentosDoDia.recordset) {
        await new sql.Request(transaction)
          .input("data_ref", validatedDate)
          .input("lancamento_id", l.id)
          .input("status_no_dia", l.status)
          .query(`
            INSERT INTO fechamento_itens (data_ref, lancamento_id, status_no_dia)
            VALUES (@data_ref, @lancamento_id, @status_no_dia)
          `);
      }

      await transaction.commit();
      res.status(201).json({ message: `Fechamento para o dia ${validatedDate} criado com sucesso.` });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if (error.number === 2627) {
      return res.status(409).json({ message: `O fechamento para o dia ${data_ref} já existe.` });
    }
    console.error("Erro ao criar fechamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getFechamento = async (req: AuthenticatedRequest, res: Response) => {
  const { data_ref } = req.params;
  try {
    const validatedDate = dateSchema.parse(data_ref);

    const fechamento = await pool
      .request()
      .input("data_ref", validatedDate)
      .query("SELECT * FROM fechamento_dia WHERE data_ref = @data_ref");

    if (fechamento.recordset.length === 0) {
      return res.status(404).json({ message: `Fechamento para o dia ${validatedDate} não encontrado.` });
    }

    const itens = await pool
      .request()
      .input("data_ref", validatedDate)
      .query(`
        SELECT
          fi.*,
          bl.tipo_recebimento,
          bl.tipo_cheque,
          bl.valor,
          bl.bom_para,
          c.nome_fantasia,
          b.codigo AS codigo_bloco
        FROM fechamento_itens fi
        JOIN bloco_lancamentos bl ON fi.lancamento_id = bl.id
        JOIN blocos b ON bl.bloco_id = b.id
        JOIN clientes c ON b.cliente_id = c.id
        WHERE fi.data_ref = @data_ref
        ORDER BY bl.tipo_recebimento, bl.bom_para
      `);

    res.json({
      ...fechamento.recordset[0],
      itens: itens.recordset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao buscar fechamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
