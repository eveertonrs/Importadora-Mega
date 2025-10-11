import { Request, Response } from "express";
import { z } from "zod";
import sql from "mssql";
import { pool } from "../db";

/* ========================= LISTAGEM / BUSCA ========================= */

// GET /clientes
export const getClientes = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search = "", q = "", status = "", tabelaPreco = "" } = req.query;

  const pageNumber = Math.max(1, Number(page));
  const limitNumber = Math.min(200, Number(limit));
  const offset = (pageNumber - 1) * limitNumber;

  try {
    const where: string[] = [];
    const request = pool.request();
    const countRequest = pool.request();

    const term =
      typeof q === "string" && q.trim() !== "" ? q : typeof search === "string" ? search : "";
    if (term && term.trim() !== "") {
      where.push("(nome_fantasia LIKE @search)");
      request.input("search", `%${term}%`);
      countRequest.input("search", `%${term}%`);
    }

    if (typeof status === "string" && (status === "ATIVO" || status === "INATIVO")) {
      where.push("status = @status");
      request.input("status", status);
      countRequest.input("status", status);
    }

    if (typeof tabelaPreco === "string" && tabelaPreco.trim() !== "") {
      where.push("tabela_preco = @tabelaPreco");
      request.input("tabelaPreco", tabelaPreco.trim());
      countRequest.input("tabelaPreco", tabelaPreco.trim());
    }

    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT id, nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, anotacoes, links_json
      FROM clientes
      ${whereSql}
      ORDER BY nome_fantasia
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    const countQuery = `SELECT COUNT(*) as total FROM clientes ${whereSql}`;

    request.input("offset", offset).input("limit", limitNumber);

    const [list, total] = await Promise.all([request.query(query), countRequest.query(countQuery)]);

    res.json({
      data: list.recordset,
      total: Number(total.recordset[0]?.total ?? 0),
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// GET /clientes/:id
export const getClienteById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const clienteRs = await pool
      .request()
      .input("id", +id)
      .query(`
        SELECT id, nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, links_json, anotacoes, criado_em, atualizado_em, recebe_whatsapp
        FROM clientes WHERE id = @id
      `);

    if (clienteRs.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    // Saldo "imediato" considerando blocos ABERTOS **ignorando bom_para**
    const saldoOpenRs = await pool
      .request()
      .input("id", +id)
      .query(`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN bl.bom_para IS NULL AND bl.sentido = 'SAIDA'   THEN bl.valor
              WHEN bl.bom_para IS NULL AND bl.sentido = 'ENTRADA' THEN -bl.valor
              ELSE 0
            END
          ), 0) AS saldo_aberto
        FROM blocos b
        LEFT JOIN bloco_lancamentos bl ON bl.bloco_id = b.id
        WHERE b.cliente_id = @id
          AND b.status = 'ABERTO'
      `);
    const saldo_aberto = Number(saldoOpenRs.recordset[0]?.saldo_aberto ?? 0);

    // A RECEBER (títulos em ABERTO/PARCIAL)
    const aReceberRs = await pool
      .request()
      .input("id", +id)
      .query(`
        SELECT COALESCE(SUM(valor_bruto - valor_baixado), 0) AS a_receber
        FROM financeiro_titulos
        WHERE cliente_id = @id
          AND status IN ('ABERTO','PARCIAL')
      `);
    const a_receber = Number(aReceberRs.recordset[0]?.a_receber ?? 0);

    // se não houver bloco ABERTO, exibe o saldo do último FECHADO (carry-over)
    let saldo_ultimo_fechado = 0;
    if (saldo_aberto === 0) {
      const lastClosed = await pool
        .request()
        .input("id", sql.Int, +id)
        .query(`
          SELECT TOP 1 b.id
          FROM blocos b
          WHERE b.cliente_id = @id AND b.status = 'FECHADO'
          ORDER BY b.fechado_em DESC, b.id DESC
        `);
      if (lastClosed.recordset.length) {
        const bid = Number(lastClosed.recordset[0].id);
        const sRS = await pool
          .request()
          .input("bid", sql.Int, bid)
          .query(`
            SELECT
              COALESCE(SUM(CASE WHEN sentido='SAIDA'   AND bom_para IS NULL THEN valor ELSE 0 END),0)
            - COALESCE(SUM(CASE WHEN sentido='ENTRADA' AND bom_para IS NULL THEN valor ELSE 0 END),0) AS saldo
            FROM bloco_lancamentos
            WHERE bloco_id = @bid
          `);
        saldo_ultimo_fechado = Number(sRS.recordset[0]?.saldo ?? 0);
      }
    }

    const cliente = clienteRs.recordset[0];
    const saldo_total = saldo_aberto !== 0 ? saldo_aberto : saldo_ultimo_fechado;

    return res.json({
      ...cliente,
      saldo_aberto,
      a_receber,
      saldo_total,
      transportadoras: [],
      documentos: [],
    });
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** GET /clientes/:id/saldo  -> { saldo, saldo_aberto, a_receber } */
export const getClienteSaldo = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const abertoRs = await pool
      .request()
      .input("id", sql.Int, +id)
      .query(`
        SELECT
          COALESCE(SUM(
            CASE
              WHEN bl.bom_para IS NULL AND bl.sentido = 'SAIDA'   THEN bl.valor
              WHEN bl.bom_para IS NULL AND bl.sentido = 'ENTRADA' THEN -bl.valor
              ELSE 0
            END
          ), 0) AS saldo_aberto
        FROM blocos b
        LEFT JOIN bloco_lancamentos bl ON bl.bloco_id = b.id
        WHERE b.cliente_id = @id
          AND b.status = 'ABERTO'
      `);
    const saldo_aberto = Number(abertoRs.recordset[0]?.saldo_aberto ?? 0);

    const aReceberRs = await pool
      .request()
      .input("id", +id)
      .query(`
        SELECT COALESCE(SUM(valor_bruto - valor_baixado), 0) AS a_receber
        FROM financeiro_titulos
        WHERE cliente_id = @id
          AND status IN ('ABERTO','PARCIAL')
      `);
    const a_receber = Number(aReceberRs.recordset[0]?.a_receber ?? 0);

    let saldo_ultimo_fechado = 0;
    if (saldo_aberto === 0) {
      const lastClosed = await pool
        .request()
        .input("id", sql.Int, +id)
        .query(`
          SELECT TOP 1 b.id
          FROM blocos b
          WHERE b.cliente_id = @id AND b.status = 'FECHADO'
          ORDER BY b.fechado_em DESC, b.id DESC
        `);
      if (lastClosed.recordset.length) {
        const bid = Number(lastClosed.recordset[0].id);
        const sRS = await pool
          .request()
          .input("bid", sql.Int, bid)
          .query(`
            SELECT
              COALESCE(SUM(CASE WHEN sentido='SAIDA'   AND bom_para IS NULL THEN valor ELSE 0 END),0)
            - COALESCE(SUM(CASE WHEN sentido='ENTRADA' AND bom_para IS NULL THEN valor ELSE 0 END),0) AS saldo
            FROM bloco_lancamentos
            WHERE bloco_id = @bid
          `);
        saldo_ultimo_fechado = Number(sRS.recordset[0]?.saldo ?? 0);
      }
    }

    const saldo_total = saldo_aberto !== 0 ? saldo_aberto : saldo_ultimo_fechado;

    return res.json({
      saldo: saldo_total,
      saldo_aberto,
      a_receber,
    });
  } catch (error) {
    console.error("Erro em getClienteSaldo:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ========================= CREATE / UPDATE / DELETE ========================= */

const clienteSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  grupo_empresa: z.string().nullish(),
  tabela_preco: z.string().min(1, "Tabela de preço é obrigatória"),
  status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
  whatsapp: z.string().nullish(),
  anotacoes: z.string().nullish(),
  links_json: z.string().nullish(),
});

const clienteDocumentoSchema = z.object({
  doc_tipo: z.enum(["CNPJ", "CPF"]),
  doc_numero: z.string().min(1, "Número do documento é obrigatório"),
  principal: z.boolean().default(false),
  modelo_nota: z.string().nullish(),
  nome: z.string().nullish(),
  tipo_nota: z.string().nullish(),
  percentual_nf: z.number().min(0).max(100).nullish(),
});

const linkSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  url: z.string().url("URL inválida"),
});

export const createCliente = async (req: Request, res: Response) => {
  try {
    const data = clienteSchema.parse(req.body);
    const statusDb = (data.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
    const allowDuplicate = String(req.query.allowDuplicate ?? "").trim() === "1";

    if (!allowDuplicate) {
      const exists = await pool
        .request()
        .input("nome", data.nome_fantasia.trim())
        .query(`SELECT TOP 1 id, status FROM clientes WHERE nome_fantasia = @nome`);
      if (exists.recordset.length) {
        return res.status(409).json({
          message: "Já existe um cliente com este nome.",
          existing_id: exists.recordset[0].id,
          existing_status: exists.recordset[0].status,
        });
      }
    }

    const result = await pool
      .request()
      .input("nome_fantasia", data.nome_fantasia)
      .input("grupo_empresa", (data.grupo_empresa ?? null) as any)
      .input("tabela_preco", data.tabela_preco)
      .input("status", statusDb)
      .input("whatsapp", (data.whatsapp ?? null) as any)
      .input("anotacoes", (data.anotacoes ?? null) as any)
      .input("links_json", (data.links_json ?? null) as any)
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
    const data = z
      .object({
        nome_fantasia: z.string().optional(),
        grupo_empresa: z.string().nullish().optional(),
        tabela_preco: z.string().optional(),
        status: z.enum(["ATIVO", "INATIVO"]).optional(),
        whatsapp: z.string().nullish().optional(),
        anotacoes: z.string().nullish().optional(),
        links_json: z.string().nullish().optional(),
      })
      .partial()
      .parse(req.body as any);

    if ((data as any).nome_fantasia && (data as any).nome_fantasia.trim()) {
      const exists = await pool
        .request()
        .input("id", +id)
        .input("nome", (data as any).nome_fantasia.trim())
        .query(`SELECT TOP 1 id FROM clientes WHERE nome_fantasia = @nome AND id <> @id`);
      if (exists.recordset.length) {
        return res.status(409).json({ message: "Já existe outro cliente com este nome." });
      }
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.body || {})) {
      if (key === "status" && typeof value === "string") {
        sanitized.status = value.toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO";
      } else if (["grupo_empresa", "whatsapp", "anotacoes", "links_json"].includes(key)) {
        sanitized[key] = value ?? null;
      } else {
        sanitized[key] = value;
      }
    }

    const fields = Object.keys(sanitized).map((k) => `${k} = @${k}`).join(", ");
    if (!fields) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const request = pool.request().input("id", +id);
    Object.entries(sanitized).forEach(([k, v]) => request.input(k, v ?? null));

    const result = await request.query(`
      UPDATE clientes SET ${fields}, atualizado_em = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    if (result.recordset.length === 0)
      return res.status(404).json({ message: "Cliente não encontrado" });
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

/* ========================= DOCUMENTOS / LINKS ========================= */

function toDbNull<T>(v: T | undefined | null): T | null {
  if (v === undefined || v === null) return null as any;
  if (typeof v === "string") {
    const s = v.trim();
    return (s === "" ? null : (s as unknown as T));
  }
  return v as unknown as T;
}

export const listClienteDocumentos = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;
  try {
    const [docs, cli] = await Promise.all([
      pool
        .request()
        .input("cliente_id", +cliente_id)
        .query(
          `SELECT id, cliente_id, doc_tipo, doc_numero, principal, modelo_nota, nome, tipo_nota, percentual_nf
           FROM cliente_documentos
           WHERE cliente_id = @cliente_id
           ORDER BY principal DESC, id DESC`
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

export const createClienteDocumento = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;

  const linkSchema = z.object({ descricao: z.string().min(1), url: z.string().url() });
  const linkParse = linkSchema.safeParse(req.body);
  if (linkParse.success) {
    try {
      const cli = await pool
        .request()
        .input("id", +cliente_id)
        .query("SELECT links_json FROM clientes WHERE id = @id");
      if (cli.recordset.length === 0)
        return res.status(404).json({ message: "Cliente não encontrado" });

      let links: Array<{ descricao: string; url: string }> = [];
      const raw = cli.recordset[0].links_json as string | null;
      if (raw) {
        try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) links = parsed; } catch {}
      }

      links.unshift({ descricao: linkParse.data.descricao, url: linkParse.data.url });

      await pool
        .request()
        .input("id", +cliente_id)
        .input("links_json", JSON.stringify(links))
        .query(
          "UPDATE clientes SET links_json = @links_json, atualizado_em = SYSUTCDATETIME() WHERE id = @id"
        );

      return res.status(201).json({ message: "Link anexado", link: linkParse.data });
    } catch (error) {
      console.error("Erro ao anexar link ao cliente:", error);
      return res.status(500).json({ message: "Erro interno no servidor" });
    }
  }

  try {
    const data = clienteDocumentoSchema.parse(req.body);

    const result = await pool
      .request()
      .input("cliente_id", +cliente_id)
      .input("doc_tipo", data.doc_tipo)
      .input("doc_numero", data.doc_numero)
      .input("principal", data.principal ?? false)
      .input("modelo_nota", data.modelo_nota ?? "")
      .input("nome", data.nome ?? "")
      .input("tipo_nota", data.tipo_nota ?? "")
      .input("percentual_nf", toDbNull((data.percentual_nf as any) ?? null))
      .query(`
        INSERT INTO cliente_documentos (cliente_id, doc_tipo, doc_numero, principal, modelo_nota, nome, tipo_nota, percentual_nf)
        OUTPUT INSERTED.*
        VALUES (@cliente_id, @doc_tipo, @doc_numero, @principal, @modelo_nota, @nome, @tipo_nota, @percentual_nf)
      `);

    return res.status(201).json(result.recordset[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Erro de validação",
        errors: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
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

    const sanitized: Record<string, any> = { ...data };
    if ("modelo_nota" in sanitized) sanitized.modelo_nota = (sanitized.modelo_nota ?? "") as string;
    if ("nome" in sanitized) sanitized.nome = (sanitized.nome ?? "") as string;
    if ("tipo_nota" in sanitized) sanitized.tipo_nota = (sanitized.tipo_nota ?? "") as string;

    const fields = Object.keys(sanitized).map((key) => `${key} = @${key}`).join(", ");
    if (!fields) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const request = pool.request().input("id", +id).input("cliente_id", +cliente_id);
    Object.entries(sanitized).forEach(([key, value]) => request.input(key, value as any));

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

/* ========================= TRANSPORTADORAS x CLIENTE ========================= */

export const setClienteTransportadoras = async (req: Request, res: Response) => {
  const { id } = req.params;
  const schema = z.object({ transportadoraIds: z.array(z.number().int().positive()).default([]) });

  try {
    const { transportadoraIds } = schema.parse(req.body);

    const cli = await pool.request().input("id", +id).query(`SELECT TOP 1 id FROM clientes WHERE id = @id`);
    if (!cli.recordset.length) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    const tx = pool.transaction();
    await tx.begin();

    try {
      await tx.request().input("id", +id).query(`DELETE FROM cliente_transportadoras WHERE cliente_id = @id`);

      if (transportadoraIds.length) {
        const values = transportadoraIds.map((_, i) => `(@id, @t${i})`).join(", ");
        const reqDb = tx.request().input("id", +id);
        transportadoraIds.forEach((tid, i) => reqDb.input(`t${i}`, tid));
        await reqDb.query(`INSERT INTO cliente_transportadoras (cliente_id, transportadora_id) VALUES ${values}`);
      }

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    const vinculos = await pool
      .request()
      .input("id", +id)
      .query(`
        SELECT t.id, t.razao_social, t.cnpj, t.telefone, t.forma_envio, t.ativo
        FROM cliente_transportadoras ct
        JOIN transportadoras t ON t.id = ct.transportadora_id
        WHERE ct.cliente_id = @id
        ORDER BY t.razao_social
      `);

    return res.json({ message: "Transportadoras atualizadas", transportadoras: vinculos.recordset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao setar transportadoras do cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export default {
  getClientes,
  getClienteById,
  getClienteSaldo,
  createCliente,
  updateCliente,
  deleteCliente,
  listClienteDocumentos,
  createClienteDocumento,
  updateClienteDocumento,
  deleteClienteDocumento,
  setClienteTransportadoras,
};
