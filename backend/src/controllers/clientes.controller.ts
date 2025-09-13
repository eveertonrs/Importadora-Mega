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
      SELECT 
        id, nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, anotacoes 
      FROM clientes
    `;
    let countQuery = "SELECT COUNT(*) as total FROM clientes";

    const params: any[] = [];
    if (search) {
      const searchQuery = `
        WHERE nome_fantasia LIKE @search 
        OR grupo_empresa LIKE @search
      `;
      query += searchQuery;
      countQuery += searchQuery;
      params.push({ name: "search", value: `%${search}%` });
    }

    query += " ORDER BY nome_fantasia OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";

    const request = pool.request();
    params.forEach(p => request.input(p.name, p.value));
    
    const result = await request
      .input("offset", offset)
      .input("limit", limitNumber)
      .query(query);

    const countRequest = pool.request();
    params.forEach(p => countRequest.input(p.name, p.value));
    const totalResult = await countRequest.query(countQuery);

    res.json({
      data: result.recordset,
      total: totalResult.recordset[0].total,
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
      .input("id", id)
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
  tabela_preco: z.string().min(1, "Tabela de preço é obrigatória"),
  status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
  whatsapp: z.string().optional(),
  anotacoes: z.string().optional(),
  links_json: z.string().optional(), // Assuming JSON is sent as a string
  codigo_alfabetico: z.string().optional(),
  forma_pagamento: z.string().optional(),
  entrega: z.string().optional(),
  tipo_tabela: z.string().optional(),
  razao_social_nf: z.string().optional(),
  cnpj_cpf_nf: z.string().optional(),
  tipo_nota: z.string().optional(),
});

const clienteDocumentoSchema = z.object({
  doc_tipo: z.enum(["CNPJ", "CPF"]),
  doc_numero: z.string().min(1, "Número do documento é obrigatório"),
  principal: z.boolean().default(false),
});

const generateCodigoAlfabetico = (nome: string) => {
  const palavras = nome.split(" ");
  let codigo = "";
  for (const palavra of palavras) {
    codigo += palavra.charAt(0).toUpperCase();
  }
  return codigo;
};

export const createCliente = async (req: Request, res: Response) => {
  try {
    const data = clienteSchema.parse(req.body);

    const codigo_alfabetico = generateCodigoAlfabetico(data.nome_fantasia);

    const request = pool
      .request()
      .input("nome_fantasia", data.nome_fantasia)
      .input("grupo_empresa", data.grupo_empresa)
      .input("tabela_preco", data.tabela_preco)
      .input("status", data.status)
      .input("whatsapp", data.whatsapp)
      .input("anotacoes", data.anotacoes)
      .input("links_json", data.links_json)
      .input("codigo_alfabetico", codigo_alfabetico)
      .input("forma_pagamento", data.forma_pagamento)
      .input("entrega", data.entrega)
      .input("tipo_tabela", data.tipo_tabela)
      .input("razao_social_nf", data.razao_social_nf)
      .input("cnpj_cpf_nf", data.cnpj_cpf_nf)
      .input("tipo_nota", data.tipo_nota)
      .input("forma_pagamento", data.forma_pagamento)
      .input("entrega", data.entrega)
      .input("tipo_tabela", data.tipo_tabela)
      .input("razao_social_nf", data.razao_social_nf)
      .input("cnpj_cpf_nf", data.cnpj_cpf_nf)
      .input("tipo_nota", data.tipo_nota)
      .input("entrega", data.entrega)
      .input("tipo_tabela", data.tipo_tabela)
      .input("razao_social_nf", data.razao_social_nf)
      .input("cnpj_cpf_nf", data.cnpj_cpf_nf)
      .input("tipo_nota", data.tipo_nota)
      .input("forma_pagamento", data.forma_pagamento)
      .input("entrega", data.entrega)
      .input("tipo_tabela", data.tipo_tabela)
      .input("razao_social_nf", data.razao_social_nf)
      .input("cnpj_cpf_nf", data.cnpj_cpf_nf)
      .input("tipo_nota", data.tipo_nota)

      .input("forma_pagamento", data.forma_pagamento)
      .input("entrega", data.entrega)
      .input("tipo_tabela", data.tipo_tabela)
      .input("razao_social_nf", data.razao_social_nf)
      .input("cnpj_cpf_nf", data.cnpj_cpf_nf)
      .input("tipo_nota", data.tipo_nota)
      .input("forma_pagamento", data.forma_pagamento)
      .input("entrega", data.entrega)
      .input("tipo_tabela", data.tipo_tabela)
      .input("razao_social_nf", data.razao_social_nf)
      .input("cnpj_cpf_nf", data.cnpj_cpf_nf)
      .input("tipo_nota", data.tipo_nota)
      .input("forma_pagamento", data.forma_pagamento)
      .input("entrega", data.entrega)
      .input("tipo_tabela", data.tipo_tabela)
      .input("razao_social_nf", data.razao_social_nf)
      .input("cnpj_cpf_nf", data.cnpj_cpf_nf)
      .input("tipo_nota", data.tipo_nota)


    const result = await request.query(
        `INSERT INTO clientes (nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, anotacoes, links_json, codigo_alfabetico, forma_pagamento, entrega, tipo_tabela, razao_social_nf, cnpj_cpf_nf, tipo_nota)
         OUTPUT INSERTED.*
         VALUES (@nome_fantasia, @grupo_empresa, @tabela_preco, @status, @whatsapp, @anotacoes, @links_json, @codigo_alfabetico, @forma_pagamento, @entrega, @tipo_tabela, @razao_social_nf, @cnpj_cpf_nf, @tipo_nota)`
      );

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

    const request = pool.request().input("id", id);
    Object.entries(data).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.query(
      `UPDATE clientes SET ${fields}, atualizado_em = GETDATE() OUTPUT INSERTED.* WHERE id = @id`
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    const codigo_alfabetico = generateCodigoAlfabetico(result.recordset[0].nome_fantasia);

    res.json({message: "Cliente atualizado com sucesso!", data: { ...result.recordset[0], codigo_alfabetico }});
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
      .input("id", id)
      .query("UPDATE clientes SET status = 'INATIVO', atualizado_em = GETDATE() WHERE id = @id");

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
      .input("cliente_id", cliente_id)
      .input("doc_tipo", data.doc_tipo)
      .input("doc_numero", data.doc_numero)
      .input("principal", data.principal)
      .query(
        `INSERT INTO cliente_documentos (cliente_id, doc_tipo, doc_numero, principal)
         OUTPUT INSERTED.*
         VALUES (@cliente_id, @doc_tipo, @doc_numero, @principal)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
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

    const request = pool.request().input("id", id).input("cliente_id", cliente_id);
    Object.entries(data).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.query(
      `UPDATE cliente_documentos SET ${fields} WHERE id = @id AND cliente_id = @cliente_id OUTPUT INSERTED.*`
    );

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
      .input("id", id)
      .input("cliente_id", cliente_id)
      .query("DELETE FROM cliente_documentos WHERE id = @id AND cliente_id = @cliente_id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Documento do cliente não encontrado" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar documento do cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
