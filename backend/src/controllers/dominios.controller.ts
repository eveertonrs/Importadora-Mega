import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const dominioSchema = z.object({
  chave: z.string().min(1, "Chave é obrigatória"),
  nome: z.string().min(1, "Nome é obrigatório"),
  ativo: z.boolean().default(true),
});

const dominioItemSchema = z.object({
  dominio_id: z.number().int(),
  valor: z.string().min(1, "Valor é obrigatório"),
  codigo: z.string().optional(),
  ordem: z.number().int().default(0),
  ativo: z.boolean().default(true),
});

export const getDominios = async (req: Request, res: Response) => {
  try {
    const result = await pool.request().query("SELECT * FROM dominios");
    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar domínios:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getDominioById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM dominios WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Domínio não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createDominio = async (req: Request, res: Response) => {
  try {
    const data = dominioSchema.parse(req.body);

    const result = await pool
      .request()
      .input("chave", data.chave)
      .input("nome", data.nome)
      .input("ativo", data.ativo)
      .query(
        `INSERT INTO dominios (chave, nome, ativo)
         OUTPUT INSERTED.*
         VALUES (@chave, @nome, @ativo)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateDominio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = dominioSchema.partial().parse(req.body);

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
      `UPDATE dominios SET ${fields} WHERE id = @id OUTPUT INSERTED.*`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Domínio não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao atualizar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteDominio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("DELETE FROM dominios WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Domínio não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getDominioItens = async (req: Request, res: Response) => {
  const { dominio_id } = req.params;
  try {
    const result = await pool
      .request()
      .input("dominio_id", dominio_id)
      .query("SELECT * FROM dominio_itens WHERE dominio_id = @dominio_id");
    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar itens do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getDominioItemById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM dominio_itens WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Item do domínio não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createDominioItem = async (req: Request, res: Response) => {
  const { dominio_id } = req.params;
  try {
    const data = dominioItemSchema.parse(req.body);

    const result = await pool
      .request()
      .input("dominio_id", dominio_id)
      .input("valor", data.valor)
      .input("codigo", data.codigo)
      .input("ordem", data.ordem)
      .input("ativo", data.ativo)
      .query(
        `INSERT INTO dominio_itens (dominio_id, valor, codigo, ordem, ativo)
         OUTPUT INSERTED.*
         VALUES (@dominio_id, @valor, @codigo, @ordem, @ativo)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateDominioItem = async (req: Request, res: Response) => {
  const { dominio_id, id } = req.params;
  try {
    const data = dominioItemSchema.partial().parse(req.body);

    const fields = Object.keys(data)
      .map((key) => `${key} = @${key}`)
      .join(", ");

    if (!fields) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const request = pool.request().input("id", id).input("dominio_id", dominio_id);
    Object.entries(data).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.query(
      `UPDATE dominio_itens SET ${fields} WHERE id = @id AND dominio_id = @dominio_id OUTPUT INSERTED.*`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Item do domínio não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao atualizar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteDominioItem = async (req: Request, res: Response) => {
  const { dominio_id, id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", id)
      .input("dominio_id", dominio_id)
      .query("DELETE FROM dominio_itens WHERE id = @id AND dominio_id = @dominio_id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Item do domínio não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
