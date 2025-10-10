import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

/**
 * Agora este controller é genérico:
 *   ?tipo=saida   -> domínio FORMA_PAGAMENTO_SAIDA (DEFAULT)
 *   ?tipo=entrada -> domínio TIPO_ENTRADA
 */

type TipoDominio = "entrada" | "saida";

const formaPagamentoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  ativo: z.boolean().default(true),
  codigo: z.string().optional().nullable(),
  ordem: z.number().int().default(0),
  descricao: z.string().optional().nullable(),
});

const formaPagamentoUpdateSchema = formaPagamentoSchema.partial();

function getDominioConfig(req: Request): { chave: string; nome: string } {
  const tipo = String(req.query.tipo ?? "saida").toLowerCase() as TipoDominio;
  if (tipo === "entrada") {
    return { chave: "TIPO_ENTRADA", nome: "Tipos de Entrada" };
  }
  return { chave: "FORMA_PAGAMENTO_SAIDA", nome: "Formas de Pagamento (Saída)" };
}

// Garante que o domínio exista e retorna seu id
async function ensureDominioId(chave: string, nome: string): Promise<number> {
  let r = await pool
    .request()
    .input("chave", chave)
    .query("SELECT id FROM dominios WHERE chave = @chave");

  if (r.recordset.length > 0) return r.recordset[0].id as number;

  try {
    r = await pool
      .request()
      .input("chave", chave)
      .input("nome", nome)
      .input("ativo", true)
      .query(
        `INSERT INTO dominios (chave, nome, ativo)
         OUTPUT INSERTED.id
         VALUES (@chave, @nome, @ativo)`
      );
    return r.recordset[0].id as number;
  } catch (err: any) {
    if (err?.number === 2627 || err?.number === 2601) {
      const again = await pool
        .request()
        .input("chave", chave)
        .query("SELECT id FROM dominios WHERE chave = @chave");
      if (again.recordset.length > 0) return again.recordset[0].id as number;
    }
    throw err;
  }
}

// LISTAR
export const getFormasPagamento = async (req: Request, res: Response) => {
  try {
    const { chave, nome } = getDominioConfig(req);
    const dominioId = await ensureDominioId(chave, nome);

    const result = await pool
      .request()
      .input("dominio_id", dominioId)
      .query(
        `SELECT id,
                valor       AS nome,
                ativo,
                codigo,
                ordem,
                descricao
           FROM dominio_itens
          WHERE dominio_id = @dominio_id
          ORDER BY ordem, valor`
      );

    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar itens do domínio de pagamento/entrada:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// OBTÉM POR ID
export const getFormaPagamentoById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { chave, nome } = getDominioConfig(req);
    const dominioId = await ensureDominioId(chave, nome);

    const result = await pool
      .request()
      .input("id", id)
      .input("dominio_id", dominioId)
      .query(
        `SELECT id,
                valor AS nome,
                ativo,
                codigo,
                ordem,
                descricao
           FROM dominio_itens
          WHERE id = @id AND dominio_id = @dominio_id`
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Registro não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar registro:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// CRIAR
export const createFormaPagamento = async (req: Request, res: Response) => {
  try {
    const data = formaPagamentoSchema.parse(req.body);
    const { chave, nome } = getDominioConfig(req);
    const dominioId = await ensureDominioId(chave, nome);

    const result = await pool
      .request()
      .input("dominio_id", dominioId)
      .input("valor", data.nome) // mapeia nome -> valor
      .input("ativo", data.ativo)
      .input("codigo", data.codigo ?? null)
      .input("ordem", data.ordem ?? 0)
      .input("descricao", data.descricao ?? null)
      .query(
        `INSERT INTO dominio_itens (dominio_id, valor, codigo, ordem, descricao, ativo)
         OUTPUT INSERTED.id, INSERTED.valor AS nome, INSERTED.ativo, INSERTED.codigo, INSERTED.ordem, INSERTED.descricao
         VALUES (@dominio_id, @valor, @codigo, @ordem, @descricao, @ativo)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Erro de validação", errors: error.errors });
    }
    if ((error as any)?.number === 2627 || (error as any)?.number === 2601) {
      return res
        .status(409)
        .json({ message: "Já existe um item com esse nome." });
    }
    console.error("Erro ao criar registro:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// ATUALIZAR
export const updateFormaPagamento = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const data = formaPagamentoUpdateSchema.parse(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const { chave, nome } = getDominioConfig(req);
    const dominioId = await ensureDominioId(chave, nome);

    // Monta SET com mapeamento nome->valor
    const mapKey = (k: string) => (k === "nome" ? "valor" : k);
    const fields = Object.keys(data)
      .map((k) => `${mapKey(k)} = @${k}`)
      .join(", ");

    const request = pool.request().input("id", id).input("dominio_id", dominioId);
    Object.entries(data).forEach(([k, v]) => request.input(k, v as any));

    const result = await request.query(
      `UPDATE dominio_itens
          SET ${fields}
        OUTPUT INSERTED.id, INSERTED.valor AS nome, INSERTED.ativo, INSERTED.codigo, INSERTED.ordem, INSERTED.descricao
        WHERE id = @id AND dominio_id = @dominio_id`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Registro não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Erro de validação", errors: error.errors });
    }
    if ((error as any)?.number === 2627 || (error as any)?.number === 2601) {
      return res
        .status(409)
        .json({ message: "Já existe um item com esse nome." });
    }
    console.error("Erro ao atualizar registro:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// DELETAR
export const deleteFormaPagamento = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { chave, nome } = getDominioConfig(req);
    const dominioId = await ensureDominioId(chave, nome);

    const result = await pool
      .request()
      .input("id", id)
      .input("dominio_id", dominioId)
      .query("DELETE FROM dominio_itens WHERE id = @id AND dominio_id = @dominio_id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Registro não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar registro:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
