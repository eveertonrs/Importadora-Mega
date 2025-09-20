import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

/** Util: transforma undefined, null ou "" em null para o DB */
const toDbNull = (v?: string | null) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "")
    ? null
    : v;

/** --------------------- LISTAGEM / BUSCA --------------------- */
export const getClientes = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search = "" } = req.query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const offset = (pageNumber - 1) * limitNumber;

  try {
    let query = `
      SELECT id, nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, anotacoes, links_json
      FROM clientes
    `;
    let countQuery = "SELECT COUNT(*) as total FROM clientes";

    const request = pool.request();
    const countRequest = pool.request();

    if (typeof search === "string" && search.trim() !== "") {
      // 🔎 inclui whatsapp na busca
      query += " WHERE (nome_fantasia LIKE @search OR grupo_empresa LIKE @search OR whatsapp LIKE @search)";
      countQuery += " WHERE (nome_fantasia LIKE @search OR grupo_empresa LIKE @search OR whatsapp LIKE @search)";
      request.input("search", `%${search}%`);
      countRequest.input("search", `%${search}%`);
    }

    query += " ORDER BY nome_fantasia OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";
    request.input("offset", offset).input("limit", limitNumber);

    const [list, total] = await Promise.all([request.query(query), countRequest.query(countQuery)]);

    res.json({
      data: list.recordset,
      total: total.recordset[0].total,
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getClienteById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.request().input("id", +id).query("SELECT * FROM clientes WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** --------------------- SCHEMAS --------------------- */
// Aceita null/undefined nos opcionais; tabela_preco é obrigatória
const clienteSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  grupo_empresa: z.string().nullish(),
  tabela_preco: z.string().min(1, "Tabela de preço é obrigatória"),
  status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
  whatsapp: z.string().nullish(),
  anotacoes: z.string().nullish(),
  links_json: z.string().nullish(), // JSON serializado (opcional)
});

// Documento fiscal (tabela cliente_documentos)
const clienteDocumentoSchema = z.object({
  doc_tipo: z.enum(["CNPJ", "CPF"]),
  doc_numero: z.string().min(1, "Número do documento é obrigatório"),
  principal: z.boolean().default(false),
});

// Link simples (para o front atual: descricao + url)
const linkSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  url: z.string().url("URL inválida"),
});

/** --------------------- CREATE / UPDATE / DELETE --------------------- */
export const createCliente = async (req: Request, res: Response) => {
  try {
    const data = clienteSchema.parse(req.body);
    const statusDb = (data.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";

    const result = await pool
      .request()
      .input("nome_fantasia", data.nome_fantasia)
      .input("grupo_empresa", toDbNull(data.grupo_empresa ?? null))
      .input("tabela_preco", data.tabela_preco) // obrigatório
      .input("status", statusDb)
      .input("whatsapp", toDbNull(data.whatsapp ?? null))
      .input("anotacoes", toDbNull(data.anotacoes ?? null))
      .input("links_json", toDbNull(data.links_json ?? null))
      .query(`
        INSERT INTO clientes (nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, anotacoes, links_json, criado_em)
        OUTPUT INSERTED.*
        VALUES (@nome_fantasia, @grupo_empresa, @tabela_preco, @status, @whatsapp, @anotacoes, @links_json, SYSUTCDATETIME())
      `);

    res.status(201).json({ message: "Cliente criado com sucesso!", data: result.recordset[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Erro de validação",
        errors: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateCliente = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = clienteSchema.partial().parse(req.body);

    // Normalizações ("" -> null) e status em UPPER
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "status" && typeof value === "string") {
        sanitized.status = value.toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
      } else if (["grupo_empresa", "whatsapp", "anotacoes", "links_json"].includes(key)) {
        sanitized[key] = toDbNull(value as any);
      } else {
        sanitized[key] = value;
      }
    }

    const fields = Object.keys(sanitized)
      .map((key) => `${key} = @${key}`)
      .join(", ");

    if (!fields) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const request = pool.request().input("id", +id);
    Object.entries(sanitized).forEach(([key, value]) => {
      request.input(key, value ?? null);
    });

    const result = await request.query(`
      UPDATE clientes SET ${fields}, atualizado_em = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    res.json({ message: "Cliente atualizado com sucesso!", data: result.recordset[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Erro de validação",
        errors: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteCliente = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", +id)
      .query(`
        UPDATE clientes
        SET status = 'INATIVO', atualizado_em = SYSUTCDATETIME()
        WHERE id = @id
      `);

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao inativar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** --------------------- DOCUMENTOS / LINKS DO CLIENTE --------------------- */

/**
 * GET de conveniência: retorna os documentos fiscais e também os links do cliente (links_json).
 */
export const listClienteDocumentos = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;
  try {
    const [docs, cli] = await Promise.all([
      pool
        .request()
        .input("cliente_id", +cliente_id)
        .query(
          `SELECT id, cliente_id, doc_tipo, doc_numero, principal, modelo_nota, nome, tipo_nota
           FROM cliente_documentos
           WHERE cliente_id = @cliente_id
           ORDER BY id DESC`
        ),
      pool.request().input("id", +cliente_id).query("SELECT links_json FROM clientes WHERE id = @id"),
    ]);

    let links: Array<{ descricao: string; url: string }> = [];
    const raw = cli.recordset?.[0]?.links_json as string | null | undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          links = parsed.filter(
            (x) => x && typeof x.descricao === "string" && typeof x.url === "string"
          );
        }
      } catch {}
    }

    res.json({ documentos: docs.recordset, links });
  } catch (error) {
    console.error("Erro ao listar documentos/links do cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/**
 * POST flexível:
 *  - Se vier {descricao, url} => anexa no links_json do cliente (sem criar linha em cliente_documentos)
 *  - Caso contrário, espera o shape de documento fiscal (doc_tipo, doc_numero, principal)
 */
export const createClienteDocumento = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;

  // tenta primeiro como link simples
  const linkParse = linkSchema.safeParse(req.body);
  if (linkParse.success) {
    try {
      // lê links_json atual
      const cli = await pool.request().input("id", +cliente_id).query("SELECT links_json FROM clientes WHERE id = @id");
      if (cli.recordset.length === 0) return res.status(404).json({ message: "Cliente não encontrado" });

      let links: Array<{ descricao: string; url: string }> = [];
      const raw = cli.recordset[0].links_json as string | null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) links = parsed;
        } catch {}
      }

      links.unshift({ descricao: linkParse.data.descricao, url: linkParse.data.url });

      await pool
        .request()
        .input("id", +cliente_id)
        .input("links_json", JSON.stringify(links))
        .query("UPDATE clientes SET links_json = @links_json, atualizado_em = SYSUTCDATETIME() WHERE id = @id");

      return res.status(201).json({ message: "Link anexado", link: linkParse.data });
    } catch (error) {
      console.error("Erro ao anexar link ao cliente:", error);
      return res.status(500).json({ message: "Erro interno no servidor" });
    }
  }

  // se não for link, trata como documento fiscal
  try {
    const data = clienteDocumentoSchema.parse(req.body);

    const result = await pool
      .request()
      .input("cliente_id", +cliente_id)
      .input("doc_tipo", data.doc_tipo)
      .input("doc_numero", data.doc_numero)
      .input("principal", data.principal)
      .query(`
        INSERT INTO cliente_documentos (cliente_id, doc_tipo, doc_numero, principal)
        OUTPUT INSERTED.*
        VALUES (@cliente_id, @doc_tipo, @doc_numero, @principal)
      `);

    return res.status(201).json(result.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Erro de validação",
        errors: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    // 2627 = unique key violation
    if (error?.number === 2627 || error?.number === 2601) {
      return res.status(409).json({ message: "Documento já cadastrado para este cliente" });
    }
    console.error("Erro ao criar documento do cliente:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateClienteDocumento = async (req: Request, res: Response) => {
  const { cliente_id, id } = req.params;
  try {
    const data = clienteDocumentoSchema.partial().parse(req.body);

    const fields = Object.keys(data)
      .map((key) => `${key} = @${key}`)
      .join(", ");

    if (!fields) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const request = pool.request().input("id", +id).input("cliente_id", +cliente_id);
    Object.entries(data).forEach(([key, value]) => {
      request.input(key, value as any);
    });

    const result = await request.query(`
      UPDATE cliente_documentos
      SET ${fields}
      OUTPUT INSERTED.*
      WHERE id = @id AND cliente_id = @cliente_id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Documento do cliente não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Erro de validação",
        errors: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    console.error("Erro ao atualizar documento do cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteClienteDocumento = async (req: Request, res: Response) => {
  const { cliente_id, id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", +id)
      .input("cliente_id", +cliente_id)
      .query(`DELETE FROM cliente_documentos WHERE id = @id AND cliente_id = @cliente_id`);

    if ((result.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ message: "Documento do cliente não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar documento do cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
