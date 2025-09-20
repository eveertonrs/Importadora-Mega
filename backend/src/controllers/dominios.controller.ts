import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const dominioSchema = z.object({
  chave: z.string().min(1, "Chave é obrigatória"),
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional().nullable(),   // <- NOVO
  ativo: z.boolean().default(true),
});

const dominioItemSchema = z.object({
  valor: z.string().min(1, "Valor é obrigatório"),
  codigo: z.string().optional().nullable(),
  ordem: z.number().int().default(0),
  descricao: z.string().optional().nullable(),   // <- NOVO
  ativo: z.boolean().default(true),
});

export const getDominios = async (_req: Request, res: Response) => {
  try {
    const result = await pool.request()
      .query("SELECT id, chave, nome, descricao, ativo FROM dominios ORDER BY nome");
    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar domínios:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getDominioById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.request()
      .input("id", +id)
      .query("SELECT id, chave, nome, descricao, ativo FROM dominios WHERE id = @id");
    if (!result.recordset.length) return res.status(404).json({ message: "Domínio não encontrado" });
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createDominio = async (req: Request, res: Response) => {
  try {
    const data = dominioSchema.parse(req.body);
    const r = await pool.request()
      .input("chave", data.chave)
      .input("nome", data.nome)
      .input("descricao", data.descricao ?? null)  // <- NOVO
      .input("ativo", data.ativo)
      .query(`
        INSERT INTO dominios (chave, nome, descricao, ativo)
        OUTPUT INSERTED.id, INSERTED.chave, INSERTED.nome, INSERTED.descricao, INSERTED.ativo
        VALUES (@chave, @nome, @descricao, @ativo)
      `);
    res.status(201).json(r.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    if (error?.number === 2627) return res.status(409).json({ message: "Chave já cadastrada" });
    console.error("Erro ao criar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateDominio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = dominioSchema.partial().parse(req.body);

    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(", ");
    if (!fields) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const q = await pool.request().input("id", +id);
    Object.entries(data).forEach(([k, v]) => q.input(k, v ?? null));

    const r = await q.query(`
      UPDATE dominios SET ${fields}
      OUTPUT INSERTED.id, INSERTED.chave, INSERTED.nome, INSERTED.descricao, INSERTED.ativo
      WHERE id = @id
    `);
    if (!r.recordset.length) return res.status(404).json({ message: "Domínio não encontrado" });
    res.json(r.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    console.error("Erro ao atualizar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteDominio = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const r = await pool.request().input("id", +id).query("DELETE FROM dominios WHERE id = @id");
    if ((r.rowsAffected?.[0] ?? 0) === 0) return res.status(404).json({ message: "Domínio não encontrado" });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getDominioItens = async (req: Request, res: Response) => {
  const { dominio_id } = req.params;
  try {
    const r = await pool.request()
      .input("dominio_id", +dominio_id)
      .query(`
        SELECT id, dominio_id, valor, codigo, ordem, descricao, ativo
        FROM dominio_itens
        WHERE dominio_id = @dominio_id
        ORDER BY ordem, valor
      `);
    res.json(r.recordset);
  } catch (error) {
    console.error("Erro ao buscar itens do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getDominioItemById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const r = await pool.request()
      .input("id", +id)
      .query("SELECT id, dominio_id, valor, codigo, ordem, descricao, ativo FROM dominio_itens WHERE id = @id");
    if (!r.recordset.length) return res.status(404).json({ message: "Item do domínio não encontrado" });
    res.json(r.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createDominioItem = async (req: Request, res: Response) => {
  const { dominio_id } = req.params;
  try {
    const data = dominioItemSchema.parse(req.body);
    const r = await pool.request()
      .input("dominio_id", +dominio_id)
      .input("valor", data.valor)
      .input("codigo", data.codigo ?? null)
      .input("ordem", data.ordem ?? 0)
      .input("descricao", data.descricao ?? null)  // <- NOVO
      .input("ativo", data.ativo ?? true)
      .query(`
        INSERT INTO dominio_itens (dominio_id, valor, codigo, ordem, descricao, ativo)
        OUTPUT INSERTED.id, INSERTED.dominio_id, INSERTED.valor, INSERTED.codigo, INSERTED.ordem, INSERTED.descricao, INSERTED.ativo
        VALUES (@dominio_id, @valor, @codigo, @ordem, @descricao, @ativo)
      `);
    res.status(201).json(r.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    if (error?.number === 2627) return res.status(409).json({ message: "Já existe um item com este valor no domínio" });
    console.error("Erro ao criar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateDominioItem = async (req: Request, res: Response) => {
  const { dominio_id, id } = req.params;
  try {
    const data = dominioItemSchema.partial().parse(req.body);
    const fields = Object.keys(data).map(k => `${k} = @${k}`).join(", ");
    if (!fields) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const q = pool.request().input("id", +id).input("dominio_id", +dominio_id);
    Object.entries(data).forEach(([k, v]) => q.input(k, v ?? null));

    const r = await q.query(`
      UPDATE dominio_itens
      SET ${fields}
      OUTPUT INSERTED.id, INSERTED.dominio_id, INSERTED.valor, INSERTED.codigo, INSERTED.ordem, INSERTED.descricao, INSERTED.ativo
      WHERE id = @id AND dominio_id = @dominio_id
    `);
    if (!r.recordset.length) return res.status(404).json({ message: "Item do domínio não encontrado" });
    res.json(r.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    console.error("Erro ao atualizar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteDominioItem = async (req: Request, res: Response) => {
  const { dominio_id, id } = req.params;
  try {
    const r = await pool.request()
      .input("id", +id)
      .input("dominio_id", +dominio_id)
      .query("DELETE FROM dominio_itens WHERE id = @id AND dominio_id = @dominio_id");
    if ((r.rowsAffected?.[0] ?? 0) === 0) return res.status(404).json({ message: "Item do domínio não encontrado" });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar item do domínio:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
