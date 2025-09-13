import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const formaPagamentoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  ativo: z.boolean().default(true),
});

export const getFormasPagamento = async (req: Request, res: Response) => {
  try {
    const result = await pool.request().query("SELECT * FROM formas_pagamento");
    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar formas de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getFormaPagamentoById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM formas_pagamento WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Forma de pagamento não encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar forma de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createFormaPagamento = async (req: Request, res: Response) => {
  try {
    const data = formaPagamentoSchema.parse(req.body);

    const result = await pool
      .request()
      .input("nome", data.nome)
      .input("ativo", data.ativo)
      .query(
        `INSERT INTO formas_pagamento (nome, ativo)
         OUTPUT INSERTED.*
         VALUES (@nome, @ativo)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar forma de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateFormaPagamento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = formaPagamentoSchema.partial().parse(req.body);

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
      `UPDATE formas_pagamento SET ${fields} WHERE id = @id OUTPUT INSERTED.*`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Forma de pagamento não encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao atualizar forma de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteFormaPagamento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("DELETE FROM formas_pagamento WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Forma de pagamento não encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar forma de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
