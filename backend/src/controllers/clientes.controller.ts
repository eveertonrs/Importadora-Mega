import { Request, Response } from "express";
import { z } from "zod";
import sql from "mssql";
import { pool } from "../db";

/* ========================= Utils ========================= */
const onlyDigits = (s: string) => String(s || "").replace(/\D+/g, "");

// map 'tipo_nota' para o que o banco aceita (CHECK: 'MEIA' | 'INTEGRAL')
const mapTipoNotaDb = (v?: string | null): "MEIA" | "INTEGRAL" => {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "MEIA" || s === "MEIA-ENTRADA" || s === "MEIA ENTRADA") return "MEIA";
  return "INTEGRAL"; // fallback seguro
};

/* ========================= LISTAGEM / BUSCA ========================= */

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
      where.push("(nome_fantasia LIKE '%' + @search + '%')");
      request.input("search", term);
      countRequest.input("search", term);
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

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

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

/* ============= Helper de saldos (mesma lógica do Bloco) ============= */
async function calcularSaldosCliente(clienteId: number) {
  // 1) Saldo do bloco: todas as movimentações (ignora CANCELADO), SAÍDA + / ENTRADA −
  const sb = await pool
    .request()
    .input("id", sql.Int, clienteId)
    .query(
      `;WITH open_bloco AS (
        SELECT id FROM dbo.blocos WHERE cliente_id = @id AND status = 'ABERTO'
      )
      SELECT
        COALESCE(SUM(
          CASE
            WHEN l.status = 'CANCELADO' THEN 0
            WHEN l.sentido = 'SAIDA'    THEN l.valor
            WHEN l.sentido = 'ENTRADA'  THEN -l.valor
            ELSE 0
          END
        ), 0) AS saldo_bloco
      FROM open_bloco b
      LEFT JOIN dbo.bloco_lancamentos l ON l.bloco_id = b.id`
    );

  const saldo_bloco = Number(sb.recordset[0]?.saldo_bloco ?? 0);

  // 2) Financeiro = imediatos (bom_para IS NULL) com o mesmo sinal + títulos BAIXADOS
  const fi = await pool
    .request()
    .input("id", sql.Int, clienteId)
    .query(
      `;WITH open_bloco AS (
        SELECT id FROM dbo.blocos WHERE cliente_id = @id AND status = 'ABERTO'
      )
      SELECT
        COALESCE((
          SELECT SUM(
            CASE
              WHEN l.status='CANCELADO' THEN 0
              WHEN l.bom_para IS NULL AND l.sentido='SAIDA'   THEN l.valor
              WHEN l.bom_para IS NULL AND l.sentido='ENTRADA' THEN -l.valor
              ELSE 0
            END
          )
          FROM open_bloco b
          LEFT JOIN dbo.bloco_lancamentos l ON l.bloco_id = b.id
        ),0) AS imediatos,
        COALESCE((
          SELECT SUM(t.valor_baixado)
          FROM open_bloco b
          JOIN dbo.financeiro_titulos t ON t.bloco_id = b.id
          WHERE t.status = 'BAIXADO'
        ),0) AS tit_baixados`
    );

  const financeiro =
    Number(fi.recordset[0]?.imediatos ?? 0) + Number(fi.recordset[0]?.tit_baixados ?? 0);

  // 3) A receber = títulos ABERTO/PARCIAL do bloco aberto
  const ar = await pool
    .request()
    .input("id", sql.Int, clienteId)
    .query(
      `;WITH open_bloco AS (
        SELECT id FROM dbo.blocos WHERE cliente_id = @id AND status = 'ABERTO'
      )
      SELECT COALESCE(SUM(t.valor_bruto - t.valor_baixado), 0) AS a_receber
      FROM open_bloco b
      JOIN dbo.financeiro_titulos t ON t.bloco_id = b.id
      WHERE t.status IN ('ABERTO','PARCIAL')`
    );

  const a_receber = Number(ar.recordset[0]?.a_receber ?? 0);

  return {
    saldo_bloco,
    financeiro,
    a_receber,
    saldo: saldo_bloco + financeiro, // total (compatibilidade)
  };
}

/* ========================= GET by ID ========================= */

export const getClienteById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const clienteRs = await pool
      .request()
      .input("id", +id)
      .query(
        `SELECT id, nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, links_json, anotacoes, criado_em, atualizado_em, recebe_whatsapp
         FROM clientes WHERE id = @id`
      );

    if (clienteRs.recordset.length === 0) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    const saldos = await calcularSaldosCliente(+id);

    return res.json({
      ...clienteRs.recordset[0],
      ...saldos, // saldo_bloco, financeiro, a_receber, saldo
      transportadoras: [],
      documentos: [],
    });
  } catch (error) {
    console.error("Erro ao buscar cliente:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ========================= Saldo isolado ========================= */

export const getClienteSaldo = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const saldos = await calcularSaldosCliente(+id);
    return res.json(saldos); // { saldo_bloco, financeiro, a_receber, saldo }
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
      .query(
        `INSERT INTO clientes (nome_fantasia, grupo_empresa, tabela_preco, status, whatsapp, anotacoes, links_json, criado_em)
         OUTPUT INSERTED.*
         VALUES (@nome_fantasia, @grupo_empresa, @tabela_preco, @status, @whatsapp, @anotacoes, @links_json, SYSUTCDATETIME())`
      );

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
    const body = z
      .object({
        nome_fantasia: z.string().min(1).optional(),
        grupo_empresa: z.string().trim().nullish().optional(),
        tabela_preco: z.string().min(1).optional(),
        status: z.enum(["ATIVO", "INATIVO"]).optional(),
        whatsapp: z.string().trim().nullish().optional(),
        anotacoes: z.string().nullish().optional(),
        links_json: z.union([z.string(), z.record(z.any())]).nullish().optional(),
        recebe_whatsapp: z.boolean().optional(), // BIT no banco
      })
      .partial()
      .parse(req.body ?? {});

    // Checagem de duplicidade do nome_fantasia
    if (body.nome_fantasia && body.nome_fantasia.trim()) {
      const dup = await pool
        .request()
        .input("id", +id)
        .input("nome", body.nome_fantasia.trim())
        .query(`SELECT TOP 1 id FROM clientes WHERE nome_fantasia = @nome AND id <> @id`);
      if (dup.recordset.length) {
        return res.status(409).json({ message: "Já existe outro cliente com este nome." });
      }
    }

    // Monta objeto sanitizado apenas com campos enviados
    const sanitized: Record<string, any> = {};

    if (body.nome_fantasia !== undefined) {
      sanitized.nome_fantasia = body.nome_fantasia.trim();
    }

    if (body.grupo_empresa !== undefined) {
      sanitized.grupo_empresa =
        body.grupo_empresa == null || body.grupo_empresa.trim() === ""
          ? null
          : body.grupo_empresa.trim();
    }

    if (body.tabela_preco !== undefined) {
      sanitized.tabela_preco = body.tabela_preco;
    }

    if (body.status !== undefined) {
      sanitized.status = body.status; // "ATIVO" | "INATIVO"
    }

    if (body.whatsapp !== undefined) {
      sanitized.whatsapp =
        body.whatsapp == null || body.whatsapp.trim() === ""
          ? null
          : body.whatsapp.replace(/\D+/g, "");
    }

    if (body.anotacoes !== undefined) {
      sanitized.anotacoes = body.anotacoes ?? null;
    }

    if (body.links_json !== undefined) {
      sanitized.links_json =
        body.links_json == null
          ? null
          : typeof body.links_json === "string"
          ? body.links_json
          : JSON.stringify(body.links_json);
    }

    if ((req.body as any).recebe_whatsapp !== undefined) {
      sanitized.recebe_whatsapp = (req.body as any).recebe_whatsapp ? 1 : 0;
    }

    if (Object.keys(sanitized).length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    // Monta UPDATE dinâmico
    const setSql = Object.keys(sanitized)
      .map((k) => `${k} = @${k}`)
      .join(", ");

    const dbReq = pool.request().input("id", +id);
    Object.entries(sanitized).forEach(([k, v]) => dbReq.input(k, v));

    const result = await dbReq.query(
      `UPDATE clientes
         SET ${setSql}, atualizado_em = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE id = @id`
    );

    if (!result.recordset.length) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    return res.json({
      message: "Cliente atualizado com sucesso!",
      data: result.recordset[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Erro de validação",
        errors: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
    }
    console.error("Erro ao atualizar cliente:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deleteCliente = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", +id)
      .query(
        `UPDATE clientes
         SET status = 'INATIVO', atualizado_em = SYSUTCDATETIME()
         WHERE id = @id`
      );

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

  // atalho: anexar link
  const linkSchema = z.object({ descricao: z.string().min(1), url: z.string().url() });
  const _linkParse = linkSchema.safeParse(req.body);
  if (_linkParse.success) {
    try {
      const cli = await pool.request().input("id", +cliente_id)
        .query("SELECT links_json FROM clientes WHERE id = @id");
      if (cli.recordset.length === 0)
        return res.status(404).json({ message: "Cliente não encontrado" });

      let links: Array<{ descricao: string; url: string }> = [];
      const raw = cli.recordset[0].links_json as string | null;
      if (raw) { try { const p = JSON.parse(raw); if (Array.isArray(p)) links = p; } catch {} }
      links.unshift(_linkParse.data);

      await pool.request()
        .input("id", +cliente_id)
        .input("links_json", JSON.stringify(links))
        .query("UPDATE clientes SET links_json=@links_json, atualizado_em=SYSUTCDATETIME() WHERE id=@id");

      return res.status(201).json({ message: "Link anexado", link: _linkParse.data });
    } catch (error) {
      console.error("Erro ao anexar link ao cliente:", error);
      return res.status(500).json({ message: "Erro interno no servidor" });
    }
  }

  try {
    const clienteDocumentoSchema = z.object({
      doc_tipo: z.enum(["CNPJ", "CPF"]),
      doc_numero: z.string().min(1),
      principal: z.boolean().default(false),
      modelo_nota: z.string().nullish(),
      nome: z.string().nullish(),
      tipo_nota: z.string().nullish(),
      percentual_nf: z.number().min(0).max(100).nullish(),
    });

    const data = clienteDocumentoSchema.parse(req.body);

    // valida doc e normaliza
    const numero = onlyDigits(data.doc_numero);
    const isValidCPF = (cpf: string) => {
      const s = onlyDigits(cpf);
      if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
      let sum = 0, rest = 0;
      for (let i = 1; i <= 9; i++) sum += parseInt(s.substring(i - 1, i)) * (11 - i);
      rest = (sum * 10) % 11; if (rest >= 10) rest = 0;
      if (rest !== parseInt(s.substring(9, 10))) return false;
      sum = 0;
      for (let i = 1; i <= 10; i++) sum += parseInt(s.substring(i - 1, i)) * (12 - i);
      rest = (sum * 10) % 11; if (rest >= 10) rest = 0;
      return rest === parseInt(s.substring(10, 11));
    };
    const isValidCNPJ = (cnpj: string) => {
      const s = onlyDigits(cnpj);
      if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
      const calc = (arr: number[]) => {
        let sum = 0;
        const w = arr.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
        arr.forEach((v, i) => (sum += v * w[i]));
        const mod = sum % 11;
        return mod < 2 ? 0 : 11 - mod;
      };
      const n = s.split("").map(Number);
      const d1 = calc(n.slice(0, 12));
      const d2 = calc(n.slice(0, 12).concat(d1));
      return d1 === n[12] && d2 === n[13];
    };

    if (data.doc_tipo === "CPF" && !isValidCPF(numero))
      return res.status(400).json({ message: "CPF inválido" });
    if (data.doc_tipo === "CNPJ" && !isValidCNPJ(numero))
      return res.status(400).json({ message: "CNPJ inválido" });

    const tx = pool.transaction();
    await tx.begin();

    try {
      if (data.principal) {
        await tx.request()
          .input("cliente_id", sql.Int, +cliente_id)
          .query("UPDATE cliente_documentos SET principal = 0 WHERE cliente_id = @cliente_id");
      }

      const reqDb = tx.request()
        .input("cliente_id", sql.Int, +cliente_id)
        .input("doc_tipo", sql.VarChar(10), data.doc_tipo)
        .input("doc_numero", sql.VarChar(32), numero)
        .input("principal", sql.Bit, !!data.principal)
        .input("modelo_nota", sql.VarChar(50), String(data.modelo_nota ?? "").trim()) // nunca null
        .input("nome", sql.VarChar(120), String(data.nome ?? "").trim())               // nunca null
        .input("tipo_nota", sql.VarChar(10), mapTipoNotaDb(data.tipo_nota))            // MEIA|INTEGRAL
        .input("percentual_nf", sql.Decimal(5, 2), data.percentual_nf == null ? null : Number(data.percentual_nf));

      const result = await reqDb.query(
        `INSERT INTO cliente_documentos
           (cliente_id, doc_tipo, doc_numero, principal, modelo_nota, nome, tipo_nota, percentual_nf)
         OUTPUT INSERTED.*
         VALUES (@cliente_id, @doc_tipo, @doc_numero, @principal, @modelo_nota, @nome, @tipo_nota, @percentual_nf)`
      );

      await tx.commit();
      return res.status(201).json(result.recordset[0]);
    } catch (e: any) {
      await tx.rollback();
      if (e?.number === 2627 || e?.number === 2601) {
        return res.status(409).json({ message: "Documento já cadastrado para este cliente" });
      }
      console.error("Erro ao criar documento do cliente:", e);
      return res.status(500).json({ message: "Erro interno no servidor" });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Erro de validação",
        errors: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    console.error("Erro ao criar documento do cliente:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updateClienteDocumento = async (req: Request, res: Response) => {
  const { cliente_id, id } = req.params;
  try {
    const clienteDocumentoSchema = z.object({
      doc_tipo: z.enum(["CNPJ", "CPF"]).optional(),
      doc_numero: z.string().min(1).optional(),
      principal: z.boolean().optional(),
      modelo_nota: z.string().nullish().optional(),
      nome: z.string().nullish().optional(),
      tipo_nota: z.string().nullish().optional(),
      percentual_nf: z.number().min(0).max(100).nullish().optional(),
    });

    const data = clienteDocumentoSchema.parse(req.body);

    const sanitized: Record<string, any> = { ...data };
    if ("doc_numero" in sanitized) sanitized.doc_numero = onlyDigits(String(sanitized.doc_numero ?? ""));
    if ("modelo_nota" in sanitized) sanitized.modelo_nota = String(sanitized.modelo_nota ?? "").trim();
    if ("nome" in sanitized) sanitized.nome = String(sanitized.nome ?? "").trim();
    if ("tipo_nota" in sanitized) sanitized.tipo_nota = mapTipoNotaDb(sanitized.tipo_nota);

    const fields = Object.keys(sanitized).map((k) => `${k} = @${k}`).join(", ");
    if (!fields) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const tx = pool.transaction();
    await tx.begin();

    try {
      if (sanitized.principal === true) {
        await tx.request()
          .input("cliente_id", sql.Int, +cliente_id)
          .query("UPDATE cliente_documentos SET principal = 0 WHERE cliente_id = @cliente_id");
      }

      const reqDb = tx.request()
        .input("id", sql.Int, +id)
        .input("cliente_id", sql.Int, +cliente_id);

      for (const [k, v] of Object.entries(sanitized)) {
        if (k === "percentual_nf") reqDb.input(k, sql.Decimal(5, 2), v == null ? null : Number(v));
        else if (k === "principal") reqDb.input(k, sql.Bit, !!v);
        else if (k === "doc_tipo") reqDb.input(k, sql.VarChar(10), v as string);
        else if (k === "doc_numero") reqDb.input(k, sql.VarChar(32), v as string);
        else if (k === "modelo_nota") reqDb.input(k, sql.VarChar(50), v as string);
        else if (k === "nome") reqDb.input(k, sql.VarChar(120), v as string);
        else if (k === "tipo_nota") reqDb.input(k, sql.VarChar(10), v as "MEIA" | "INTEGRAL");
        else reqDb.input(k, v as any);
      }

      const result = await reqDb.query(
        `UPDATE cliente_documentos
         SET ${fields}
         OUTPUT INSERTED.*
         WHERE id = @id AND cliente_id = @cliente_id`
      );

      await tx.commit();

      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "Documento do cliente não encontrado" });
      }

      res.json(result.recordset[0]);
    } catch (e) {
      await tx.rollback();
      throw e;
    }
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
      .query(
        `SELECT t.id, t.razao_social, t.cnpj, t.telefone, t.forma_envio, t.ativo
         FROM cliente_transportadoras ct
         JOIN transportadoras t ON t.id = ct.transportadora_id
         WHERE ct.cliente_id = @id
         ORDER BY t.razao_social`
      );

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
