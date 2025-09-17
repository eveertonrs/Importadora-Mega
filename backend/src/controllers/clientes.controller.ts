import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

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
      query += " WHERE nome_fantasia LIKE @search OR grupo_empresa LIKE @search";
      countQuery += " WHERE nome_fantasia LIKE @search OR grupo_empresa LIKE @search";
      request.input("search", `%${search}%`);
      countRequest.input("search", `%${search}%`);
    }

    query += " ORDER BY nome_fantasia OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";

    request.input("offset", offset).input("limit", limitNumber);

    const [list, total] = await Promise.all([
      request.query(query),
      countRequest.query(countQuery),
    ]);

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
    const result = await pool
      .request()
      .input("id", +id)
      .query("SELECT * FROM clientes WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const clienteSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  grupo_empresa: z.string().optional(),
  tabela_preco: z.string().optional(),
  status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
  whatsapp: z.string().optional(),
  anotacoes: z.string().optional(),
  links_json: z.string().optional(), // JSON serializado (opcional)
});

const clienteDocumentoSchema = z.object({
  doc_tipo: z.enum(["CNPJ", "CPF"]),
  doc_numero: z.string().min(1, "Número do documento é obrigatório"),
  principal: z.boolean().default(false),
  nome: z.string().min(1, "Nome/Razão Social é obrigatório"),
  tipo_nota: z.enum(["INTEGRAL", "MEIA"]).default("INTEGRAL"),
});

export const createCliente = async (req: Request, res: Response) => {
  try {
    const data = clienteSchema.parse(req.body);

    const result = await pool
      .request()
      .input("nome_fantasia", data.nome_fantasia)
      .input("grupo_empresa", data.grupo_empresa ?? null)
      .input("tabela_preco", data.tabela_preco ?? null)
      .input("status", data.status)
      .input("whatsapp", data.whatsapp ?? null)
      .input("anotacoes", data.anotacoes ?? null)
      .input("links_json", data.links_json ?? null)
      .query(`
        INSERT INTO clientes (nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, anotacoes, links_json, criado_em)
        OUTPUT INSERTED.*
        VALUES (@nome_fantasia, @grupo_empresa, @tabela_preco, @status, @whatsapp, @anotacoes, @links_json, SYSUTCDATETIME())
      `);

    res.status(201).json({ message: "Cliente criado com sucesso!", data: result.recordset[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateCliente = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = clienteSchema.partial().parse(req.body);

    const fields = Object.keys(data)
      .map((key) => `${key} = @${key}`)
      .join(", ");

    if (!fields) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const request = pool.request().input("id", +id);
    Object.entries(data).forEach(([key, value]) => {
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
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
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

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao inativar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createClienteDocumento = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;
  try {
    const data = clienteDocumentoSchema.parse(req.body);

    const result = await pool
      .request()
      .input("cliente_id", +cliente_id)
      .input("doc_tipo", data.doc_tipo)
      .input("doc_numero", data.doc_numero)
      .input("principal", data.principal)
      .input("nome", data.nome)
      .input("tipo_nota", data.tipo_nota)
      .query(`
        INSERT INTO cliente_documentos (cliente_id, doc_tipo, doc_numero, principal, nome, tipo_nota)
        OUTPUT INSERTED.*
        VALUES (@cliente_id, @doc_tipo, @doc_numero, @principal, @nome, @tipo_nota)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if (error.number === 2627) {
      return res.status(409).json({ message: "Documento já cadastrado para este cliente" });
    }
    console.error("Erro ao criar documento do cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
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
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
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
      .query(`
        DELETE FROM cliente_documentos WHERE id = @id AND cliente_id = @cliente_id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Documento do cliente não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar documento do cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
