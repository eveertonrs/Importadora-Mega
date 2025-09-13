import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const transportadoraSchema = z.object({
  razao_social: z.string().min(1, "Razão Social é obrigatória"),
  cnpj: z.string().optional(),
  forma_envio: z.string().optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  referencia: z.string().optional(),
  ativo: z.boolean().default(true),
});

export const getTransportadoras = async (req: Request, res: Response) => {
  try {
    const result = await pool.request().query("SELECT * FROM transportadoras");
    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar transportadoras:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getTransportadoraById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM transportadoras WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Transportadora não encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createTransportadora = async (req: Request, res: Response) => {
  try {
    const data = transportadoraSchema.parse(req.body);

    const result = await pool
      .request()
      .input("razao_social", data.razao_social)
      .input("cnpj", data.cnpj)
      .input("forma_envio", data.forma_envio)
      .input("telefone", data.telefone)
      .input("endereco", data.endereco)
      .input("referencia", data.referencia)
      .input("ativo", data.ativo)
      .query(
        `INSERT INTO transportadoras (razao_social, cnpj, forma_envio, telefone, endereco, referencia, ativo)
         OUTPUT INSERTED.*
         VALUES (@razao_social, @cnpj, @forma_envio, @telefone, @endereco, @referencia, @ativo)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateTransportadora = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = transportadoraSchema.partial().parse(req.body);

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
      `UPDATE transportadoras SET ${fields} WHERE id = @id OUTPUT INSERTED.*`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Transportadora não encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao atualizar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteTransportadora = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("DELETE FROM transportadoras WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Transportadora não encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar transportadora:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
