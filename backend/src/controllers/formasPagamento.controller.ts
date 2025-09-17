import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const DOMINIO_CHAVE = "FORMA_PAGAMENTO";

// Schemas (mapeando nome -> valor em dominio_itens)
const formaPagamentoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  ativo: z.boolean().default(true),
  codigo: z.string().optional(),
  ordem: z.number().int().default(0),
});

const formaPagamentoUpdateSchema = formaPagamentoSchema.partial();

// Garante que o domínio exista e retorna seu id
async function ensureDominioId(): Promise<number> {
  // tenta buscar
  let r = await pool
    .request()
    .input("chave", DOMINIO_CHAVE)
    .query("SELECT id FROM dominios WHERE chave = @chave");

  if (r.recordset.length > 0) {
    return r.recordset[0].id as number;
  }

  // cria se não existir
  try {
    r = await pool
      .request()
      .input("chave", DOMINIO_CHAVE)
      .input("nome", "Formas de Pagamento")
      .input("ativo", true)
      .query(
        `INSERT INTO dominios (chave, nome, ativo)
         OUTPUT INSERTED.id
         VALUES (@chave, @nome, @ativo)`
      );
    return r.recordset[0].id as number;
  } catch (err: any) {
    // condição de corrida: outro request inseriu antes
    if (err?.number === 2627) {
      const again = await pool
        .request()
        .input("chave", DOMINIO_CHAVE)
        .query("SELECT id FROM dominios WHERE chave = @chave");
      if (again.recordset.length > 0) {
        return again.recordset[0].id as number;
      }
    }
    throw err;
  }
}

// LISTAR
export const getFormasPagamento = async (req: Request, res: Response) => {
  try {
    const dominioId = await ensureDominioId();
    const result = await pool
      .request()
      .input("dominio_id", dominioId)
      .query(
        `SELECT id,
                valor       AS nome,
                ativo,
                codigo,
                ordem
           FROM dominio_itens
          WHERE dominio_id = @dominio_id
          ORDER BY ordem, valor`
      );

    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar formas de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// OBTÉM POR ID
export const getFormaPagamentoById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const dominioId = await ensureDominioId();
    const result = await pool
      .request()
      .input("id", id)
      .input("dominio_id", dominioId)
      .query(
        `SELECT id,
                valor AS nome,
                ativo,
                codigo,
                ordem
           FROM dominio_itens
          WHERE id = @id AND dominio_id = @dominio_id`
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Forma de pagamento não encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar forma de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// CRIAR
export const createFormaPagamento = async (req: Request, res: Response) => {
  try {
    const data = formaPagamentoSchema.parse(req.body);
    const dominioId = await ensureDominioId();

    const result = await pool
      .request()
      .input("dominio_id", dominioId)
      .input("valor", data.nome)     // mapeia nome -> valor
      .input("ativo", data.ativo)
      .input("codigo", data.codigo ?? null)
      .input("ordem", data.ordem ?? 0)
      .query(
        `INSERT INTO dominio_itens (dominio_id, valor, codigo, ordem, ativo)
         OUTPUT INSERTED.id, INSERTED.valor AS nome, INSERTED.ativo, INSERTED.codigo, INSERTED.ordem
         VALUES (@dominio_id, @valor, @codigo, @ordem, @ativo)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    // violação do unique (dominio_id, valor)
    if ((error as any)?.number === 2627) {
      return res.status(409).json({ message: "Já existe uma forma de pagamento com esse nome." });
    }
    console.error("Erro ao criar forma de pagamento:", error);
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

    const dominioId = await ensureDominioId();

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
        OUTPUT INSERTED.id, INSERTED.valor AS nome, INSERTED.ativo, INSERTED.codigo, INSERTED.ordem
        WHERE id = @id AND dominio_id = @dominio_id`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Forma de pagamento não encontrada" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if ((error as any)?.number === 2627) {
      return res.status(409).json({ message: "Já existe uma forma de pagamento com esse nome." });
    }
    console.error("Erro ao atualizar forma de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// DELETAR
export const deleteFormaPagamento = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const dominioId = await ensureDominioId();
    const result = await pool
      .request()
      .input("id", id)
      .input("dominio_id", dominioId)
      .query("DELETE FROM dominio_itens WHERE id = @id AND dominio_id = @dominio_id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Forma de pagamento não encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar forma de pagamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
