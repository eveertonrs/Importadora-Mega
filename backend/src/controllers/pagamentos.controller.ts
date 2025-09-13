import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const pagamentoSchema = z.object({
  cliente_id: z.number().int(),
  data_lancamento: z.string().datetime(),
  data_vencimento: z.string().datetime(),
  valor: z.number(),
  forma_pagamento: z.string(),
  observacoes: z.string().optional(),
});

export const getPagamentos = async (req: Request, res: Response) => {
  try {
    const result = await pool.request().query("SELECT * FROM pagamentos");
    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getPagamentoById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM pagamentos WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Pagamento não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createPagamento = async (req: Request, res: Response) => {
  try {
    const data = pagamentoSchema.parse(req.body);

    const result = await pool
      .request()
      .input("cliente_id", data.cliente_id)
      .input("data_lancamento", data.data_lancamento)
      .input("data_vencimento", data.data_vencimento)
      .input("valor", data.valor)
      .input("forma_pagamento", data.forma_pagamento)
      .input("observacoes", data.observacoes)
      .query(
        `INSERT INTO pagamentos (cliente_id, data_lancamento, data_vencimento, valor, forma_pagamento, observacoes)
         OUTPUT INSERTED.*
         VALUES (@cliente_id, @data_lancamento, @data_vencimento, @valor, @forma_pagamento, @observacoes)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updatePagamento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = pagamentoSchema.partial().parse(req.body);

    const fields = Object.keys(data)
      .map((key) => `${key} = @${key}`)
      .join(", ");

    if (!fields) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const request = pool.request().input("id", id);
    Object.entries(data).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.query(
      `UPDATE pagamentos SET ${fields} WHERE id = @id OUTPUT INSERTED.*`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Pagamento não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao atualizar pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deletePagamento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("DELETE FROM pagamentos WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Pagamento não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getSaldo = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;

  try {
    const result = await pool
      .request()
      .input("cliente_id", cliente_id)
      .query(
        `SELECT 
            SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE 0 END) as totalEntrada,
            SUM(CASE WHEN tipo = 'SAIDA' THEN valor ELSE 0 END) as totalSaida
          FROM pagamentos
          WHERE cliente_id = @cliente_id`
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    const { totalEntrada, totalSaida } = result.recordset[0];
    const saldo = totalEntrada - totalSaida;

    res.json({ saldo });
  } catch (error) {
    console.error("Erro ao buscar saldo:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getHistorico = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;

  try {
    const result = await pool
      .request()
      .input("cliente_id", cliente_id)
      .query(
        `SELECT *
          FROM pagamentos
          WHERE cliente_id = @cliente_id
          ORDER BY data_lancamento DESC`
      );

    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
