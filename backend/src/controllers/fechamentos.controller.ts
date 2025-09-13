import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import sql from "mssql";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido. Use YYYY-MM-DD");

export const createFechamento = async (req: AuthenticatedRequest, res: Response) => {
  const { data_ref } = req.params;
  const userId = req.user!.id;

  try {
    const validatedDate = dateSchema.parse(data_ref);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Cria o registro principal de fechamento
      const fechamentoReq = new sql.Request(transaction);
      await fechamentoReq
        .input("data_ref", validatedDate)
        .input("criado_por", userId)
        .query("INSERT INTO fechamento_dia (data_ref, criado_por) VALUES (@data_ref, @criado_por)");

      // 2. Busca todos os lançamentos do dia
      const lancamentosReq = new sql.Request(transaction);
      const lancamentosDoDia = await lancamentosReq
        .input("data_ref", validatedDate)
        .query("SELECT id, status FROM bloco_lancamentos WHERE CONVERT(date, data_lancamento) = @data_ref");

      // 3. Insere os itens do fechamento
      for (const lancamento of lancamentosDoDia.recordset) {
        const itemReq = new sql.Request(transaction);
        await itemReq
          .input("data_ref", validatedDate)
          .input("lancamento_id", lancamento.id)
          .input("status_no_dia", lancamento.status)
          .query("INSERT INTO fechamento_itens (data_ref, lancamento_id, status_no_dia) VALUES (@data_ref, @lancamento_id, @status_no_dia)");
      }

      await transaction.commit();
      res.status(201).json({ message: `Fechamento para o dia ${validatedDate} criado com sucesso.` });

    } catch (err) {
      await transaction.rollback();
      throw err; // Re-throw para ser pego pelo catch externo
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar fechamento:", error);
    // Verifica erro de chave primária duplicada
    if ((error as any).number === 2627) {
      return res.status(409).json({ message: `O fechamento para o dia ${data_ref} já existe.` });
    }
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getFechamento = async (req: Request, res: Response) => {
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
        SELECT fi.*, bl.tipo_recebimento, bl.valor, bl.bom_para, c.nome_fantasia
        FROM fechamento_itens fi
        JOIN bloco_lancamentos bl ON fi.lancamento_id = bl.id
        JOIN blocos b ON bl.bloco_id = b.id
        JOIN clientes c ON b.cliente_id = c.id
        WHERE fi.data_ref = @data_ref
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
