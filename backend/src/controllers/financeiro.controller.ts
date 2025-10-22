import { Request, Response } from "express";
import { z } from "zod";
import sql from "mssql";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

/* ======================================================================
   HELPERS
   ====================================================================== */

function toISO(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Aceita YYYY-MM-DD e retorna a mesma string validada (Date-only) */
function toISODateOnly(s?: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (isNaN(d.getTime())) return null;
  return `${yyyy}-${mm}-${dd}`;
}

type TituloRow = {
  id: number;
  cliente_id: number;
  bloco_id: number | null;
  bloco_lanc_id: number | null;
  tipo: string | null;
  bom_para: Date | null;
  valor_bruto: number;
  valor_baixado: number;
  status: string;
};

/** Busca título com fallback para schema antigo (sem bloco_lanc_id) */
async function fetchTituloById(tituloId: number): Promise<TituloRow> {
  try {
    const r = await pool
      .request()
      .input("id", sql.Int, tituloId)
      .query(`
        SELECT id, cliente_id, bloco_id, bloco_lanc_id, tipo, bom_para, valor_bruto, valor_baixado, status
        FROM dbo.financeiro_titulos
        WHERE id = @id
      `);
    if (!r.recordset.length) throw new Error("Título não encontrado");
    return r.recordset[0] as TituloRow;
  } catch (e: any) {
    const num = e?.number ?? e?.originalError?.number;
    const msg = String(e?.message || "");
    if (num !== 207 && !/Invalid column name 'bloco_lanc_id'/i.test(msg)) throw e;
    const r2 = await pool
      .request()
      .input("id", sql.Int, tituloId)
      .query(`
        SELECT id, cliente_id, bloco_id,
               CAST(NULL AS int) AS bloco_lanc_id,
               tipo, bom_para, valor_bruto, valor_baixado, status
        FROM dbo.financeiro_titulos
        WHERE id = @id
      `);
    if (!r2.recordset.length) throw new Error("Título não encontrado");
    return r2.recordset[0] as TituloRow;
  }
}

/** Resolve o id do lançamento no bloco para atualizar status */
async function resolveLancId(
  tx: sql.Transaction,
  titulo: TituloRow
): Promise<number | null> {
  if (!titulo.bloco_id) return null;
  if (titulo.bloco_lanc_id) return titulo.bloco_lanc_id;

  const r = await new sql.Request(tx)
    .input("bloco_id", sql.Int, titulo.bloco_id)
    .input("tipo", sql.VarChar(30), String(titulo.tipo || "").toUpperCase())
    .input("valor", sql.Decimal(18, 2), Number(titulo.valor_bruto || 0))
    .input("bom_para", sql.Date, titulo.bom_para ? new Date(titulo.bom_para) : null)
    .query(`
      SELECT TOP 1 id
      FROM dbo.bloco_lancamentos
      WHERE bloco_id = @bloco_id
        AND sentido = 'SAIDA'
        AND UPPER(tipo_recebimento) = @tipo
        AND ABS(valor - @valor) < 0.01
        AND (
              (@bom_para IS NULL AND bom_para IS NULL)
           OR ( @bom_para IS NOT NULL AND bom_para IS NOT NULL AND CAST(bom_para AS date) = CAST(@bom_para AS date) )
        )
      ORDER BY id DESC
    `);

  return r.recordset.length ? Number(r.recordset[0].id) : null;
}

/* ======================================================================
   1) REGISTRAR BAIXA DE TÍTULO
   ====================================================================== */

const baixaSchema = z.object({
  valor: z.coerce.number().positive().optional(),
  valor_baixa: z.coerce.number().positive().optional(),
  data_baixa: z.string().optional(),
  forma: z.string().optional(),
  forma_pagto: z.string().optional(),
  observacao: z.string().optional(),
  obs: z.string().optional(),
});

export const registrarBaixaTitulo = async (req: AuthenticatedRequest, res: Response) => {
  const tituloId = Number(req.params.id);
  if (!Number.isFinite(tituloId)) return res.status(400).json({ message: "ID inválido" });

  try {
    const raw = baixaSchema.parse(req.body);
    const valor = (raw.valor_baixa ?? raw.valor)!;
    if (!valor) return res.status(400).json({ message: "Informe um valor de baixa" });

    const forma = raw.forma_pagto ?? raw.forma ?? undefined;
    const observacao = raw.obs ?? raw.observacao ?? undefined;
    const userId = req.user?.id ?? null;

    const titulo = await fetchTituloById(tituloId);

    const novoBaixado = Number(titulo.valor_baixado ?? 0) + valor;
    const statusNovo = novoBaixado >= Number(titulo.valor_bruto ?? 0) ? "BAIXADO" : "PARCIAL";

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // 1) Atualiza o título
      await new sql.Request(tx)
        .input("id", sql.Int, titulo.id)
        .input("valor_baixado", sql.Decimal(18, 2), novoBaixado)
        .input("status", sql.VarChar(20), statusNovo)
        .query(`
          UPDATE dbo.financeiro_titulos
             SET valor_baixado = @valor_baixado,
                 status = @status
           WHERE id = @id
        `);

      // 2) Se virou BAIXADO, marca o lançamento do bloco
      if (statusNovo === "BAIXADO" && titulo.bloco_id) {
        const lancIdToUpdate = await resolveLancId(tx, titulo);
        if (lancIdToUpdate) {
          try {
            await new sql.Request(tx)
              .input("id", sql.Int, lancIdToUpdate)
              .input("obsExtra", sql.VarChar(sql.MAX), (observacao ? ` • ${observacao}` : ""))
              .query(`
                UPDATE dbo.bloco_lancamentos
                   SET status = 'BAIXADO NO FINANCEIRO',
                       observacao = LEFT(CONCAT(COALESCE(observacao,''), ' (baixa ${forma ?? ''}', @obsExtra, ')'), 300),
                       atualizado_em = SYSUTCDATETIME()
                 WHERE id = @id
              `);
          } catch (e: any) {
            // fallback sem atualizado_em
            await new sql.Request(tx)
              .input("id", sql.Int, lancIdToUpdate)
              .input("obsExtra", sql.VarChar(sql.MAX), (observacao ? ` • ${observacao}` : ""))
              .query(`
                UPDATE dbo.bloco_lancamentos
                   SET status = 'BAIXADO NO FINANCEIRO',
                       observacao = CONCAT(COALESCE(observacao,''), ' (baixa ${forma ?? ''}', @obsExtra, ')')
                 WHERE id = @id
              `);
          }
        }
      }

      await tx.commit();
      return res.json({ message: "Baixa registrada", status: statusNovo, valor_baixado: novoBaixado });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Erro de validação", errors: e.errors });
    console.error("Erro ao registrar baixa:", e);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ======================================================================
   1.1) ESTORNAR BAIXA (volta o título para ABERTO e o lançamento do bloco para EM ABERTO)
   ====================================================================== */

// === ESTORNO DE BAIXA DE TÍTULO (corrigido para usar PENDENTE no bloco) ===
export const estornarBaixaTitulo = async (req: AuthenticatedRequest, res: Response) => {
  const tituloId = Number(req.params.id);
  if (!Number.isFinite(tituloId)) return res.status(400).json({ message: "ID inválido" });

  try {
    const titulo = await fetchTituloById(tituloId);

    if (Number(titulo.valor_baixado || 0) <= 0 && titulo.status !== "BAIXADO") {
      return res.status(400).json({ message: "Título não está baixado." });
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // 1) Título volta a ABERTO (tabela: financeiro_titulos)
      await new sql.Request(tx)
        .input("id", sql.Int, titulo.id)
        .query(`
          UPDATE dbo.financeiro_titulos
             SET valor_baixado = 0,
                 status = 'ABERTO'
           WHERE id = @id
        `);

      // 2) Lançamento do bloco volta para PENDENTE (tabela: bloco_lancamentos)
      if (titulo.bloco_id) {
        const lancIdToUpdate = await resolveLancId(tx, titulo);
        if (lancIdToUpdate) {
          try {
            await new sql.Request(tx)
              .input("id", sql.Int, lancIdToUpdate)
              .query(`
                UPDATE dbo.bloco_lancamentos
                   SET status = 'PENDENTE',
                       observacao = LEFT(CONCAT(COALESCE(observacao,''), ' (estorno de baixa)'), 300),
                       atualizado_em = SYSUTCDATETIME()
                 WHERE id = @id
              `);
          } catch {
            // fallback sem coluna atualizado_em
            await new sql.Request(tx)
              .input("id", sql.Int, lancIdToUpdate)
              .query(`
                UPDATE dbo.bloco_lancamentos
                   SET status = 'PENDENTE',
                       observacao = CONCAT(COALESCE(observacao,''), ' (estorno de baixa)')
                 WHERE id = @id
              `);
          }
        }
      }

      await tx.commit();
      return res.json({ message: "Estorno realizado", status: "ABERTO", valor_baixado: 0 });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (e) {
    console.error("Erro ao estornar baixa:", e);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};



/* ======================================================================
   2) LISTAGEM DE TÍTULOS (usada pelo /financeiro/receber)
   ====================================================================== */

const listTitulosQuery = z.object({
  status: z.string().optional(),  // "ABERTO,PARCIAL" | "BAIXADO" | "ABERTO,PARCIAL,BAIXADO"
  tipo: z.string().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
});

export const listTitulos = async (req: Request, res: Response) => {
  try {
    const { status, tipo, de, ate, from, to, q, page, pageSize } = listTitulosQuery.parse(req.query);
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const baseReq = pool.request().input("limit", sql.Int, pageSize).input("offset", sql.Int, offset);

    if (status) {
      const parts = status.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (parts.length) {
        const inParams: string[] = [];
        parts.forEach((st, idx) => {
          const name = `st${idx}`;
          inParams.push(`@${name}`);
          baseReq.input(name, sql.VarChar(20), st);
        });
        where.push(`t.status IN (${inParams.join(",")})`);
      }
    }

    if (tipo) {
      where.push(`UPPER(t.tipo) = @tipo`);
      baseReq.input("tipo", sql.VarChar(30), tipo.toUpperCase());
    }

    const deStr = de ?? from ?? undefined;
    const ateStr = ate ?? to ?? undefined;
    const deISO = toISODateOnly(deStr);
    const ateISO = toISODateOnly(ateStr);

    if (deISO) {
      where.push(`CAST(t.bom_para AS date) >= @de`);
      baseReq.input("de", sql.Date, new Date(deISO));
    }
    if (ateISO) {
      where.push(`CAST(t.bom_para AS date) <= @ate`);
      baseReq.input("ate", sql.Date, new Date(ateISO));
    }

    if (q) {
      where.push(`(t.numero_doc LIKE '%' + @q + '%' OR t.observacao LIKE '%' + @q + '%')`);
      baseReq.input("q", sql.VarChar(200), q);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const totalRs = await baseReq.query(`
      SELECT COUNT(*) AS total
      FROM dbo.financeiro_titulos t
      LEFT JOIN dbo.clientes c ON c.id = t.cliente_id
      ${whereSql}
    `);
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    const pageReq = pool.request().input("limit", sql.Int, pageSize).input("offset", sql.Int, offset);
    if (status) {
      const parts = status.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      parts.forEach((st, idx) => pageReq.input(`st${idx}`, sql.VarChar(20), st));
    }
    if (tipo) pageReq.input("tipo", sql.VarChar(30), tipo.toUpperCase());
    if (deISO) pageReq.input("de", sql.Date, new Date(deISO));
    if (ateISO) pageReq.input("ate", sql.Date, new Date(ateISO));
    if (q) pageReq.input("q", sql.VarChar(200), q);

    const rs = await pageReq.query(`
      SELECT
        t.id,
        t.cliente_id,
        c.nome_fantasia AS cliente_nome,
        t.tipo,
        t.numero_doc,
        t.bom_para,
        t.valor_bruto,
        t.valor_baixado,
        t.status,
        t.observacao,
        t.bloco_id
      FROM dbo.financeiro_titulos t
      LEFT JOIN dbo.clientes c ON c.id = t.cliente_id
      ${whereSql}
      ORDER BY t.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return res.json({ data: rs.recordset, page, pageSize, total });
  } catch (err) {
    console.error("Erro em listTitulos:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ======================================================================
   3) CONFERÊNCIA DIÁRIA e 4) ATUALIZAR CONFERÊNCIA
   (inalterados em relação ao teu último envio, mantidos)
   ====================================================================== */

const conferenciaQuery = z.object({
  data: z.string().optional(),
  operador_id: z.coerce.number().optional(),
  cliente_id: z.coerce.number().optional(),
});

export const conferenciaDiaria = async (req: Request, res: Response) => {
  try {
    const { data, cliente_id } = conferenciaQuery.parse(req.query);
    const dia = toISODateOnly(data ?? new Date().toISOString().slice(0, 10));
    if (!dia) return res.status(400).json({ message: "Data inválida" });

    const r = await pool
      .request()
      .input("dia", sql.Date, new Date(dia))
      .input("cliente_id", cliente_id ?? null)
      .query(`
        WITH lanc AS (
          SELECT
            bl.id                           AS origem_id,
            'BLOCO_LANC'                    AS origem,
            CAST(bl.data_lancamento AS date) AS data_evento,
            b.cliente_id,
            c.nome_fantasia                 AS cliente_nome,
            bl.tipo_recebimento             AS tipo,
            bl.numero_referencia            AS numero_doc,
            CAST(NULL AS date)              AS bom_para,
            bl.valor                        AS valor,
            bl.status                       AS status_negocio,
            bl.bloco_id                     AS bloco_id,
            CAST(NULL AS int)               AS titulo_id
          FROM dbo.bloco_lancamentos bl
          JOIN dbo.blocos b ON b.id = bl.bloco_id
          LEFT JOIN dbo.clientes c ON c.id = b.cliente_id
          WHERE CAST(bl.data_lancamento AS date) = @dia
            AND bl.bom_para IS NULL
            AND (@cliente_id IS NULL OR b.cliente_id = @cliente_id)
        ),
        tit AS (
          SELECT
            t.id                             AS origem_id,
            'TITULO'                         AS origem,
            COALESCE(CAST(t.bom_para AS date), CAST(t.created_at AS date)) AS data_evento,
            t.cliente_id,
            c.nome_fantasia                  AS cliente_nome,
            t.tipo                           AS tipo,
            t.numero_doc                     AS numero_doc,
            CAST(t.bom_para AS date)         AS bom_para,
            t.valor_bruto                    AS valor,
            t.status                         AS status_negocio,
            t.bloco_id                       AS bloco_id,
            t.id                             AS titulo_id
          FROM dbo.financeiro_titulos t
          LEFT JOIN dbo.clientes c ON c.id = t.cliente_id
          WHERE (
                  CAST(t.bom_para AS date) = @dia
               OR CAST(t.created_at AS date) = @dia
                )
            AND (@cliente_id IS NULL OR t.cliente_id = @cliente_id)
        )
        SELECT
          ROW_NUMBER() OVER (ORDER BY x.data_evento, x.origem, x.origem_id) AS id,
          x.*,
          fc.status       AS status_conferencia,
          fc.obs          AS comentario,
          fc.conferido_em,
          fc.conferido_por
        FROM (
          SELECT * FROM lanc
          UNION ALL
          SELECT * FROM tit
        ) x
        LEFT JOIN dbo.financeiro_conferencia fc
          ON fc.ref_tipo = x.origem AND fc.ref_id = x.origem_id
        ORDER BY x.data_evento, x.origem, x.origem_id
      `);

    const itens = r.recordset as Array<any>;

    const resumo: Record<string, number> = {};
    for (const it of itens) {
      const k = String(it.tipo || "-");
      resumo[k] = (resumo[k] ?? 0) + Number(it.valor || 0);
    }

    return res.json({ data: dia, total: itens.length, resumo, itens });
  } catch (err) {
    console.error("Erro em conferenciaDiaria:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const conferenciaAtualizarSchema = z.object({
  data: z.string().optional(),
  status: z.enum(["PENDENTE", "CONFIRMADO", "DIVERGENTE"]),
  comentario: z.string().optional(),
  itens: z
    .array(
      z.object({
        origem: z.enum(["BLOCO_LANC", "TITULO", "BAIXA"]),
        origem_id: z.number().int().positive(),
      })
    )
    .min(1),
});

export const conferenciaAtualizar = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, comentario, itens } = conferenciaAtualizarSchema.parse(req.body);
    const userId = req.user?.id ?? null;

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      for (const row of itens) {
        const ref_tipo = row.origem === "BAIXA" ? "BLOCO_LANC" : row.origem;
        const ref_id = row.origem_id;

        let data_ref: Date | null = null;

        if (ref_tipo === "TITULO") {
          const r = await new sql.Request(tx)
            .input("id", sql.Int, ref_id)
            .query(
              `SELECT TOP 1 CAST(COALESCE(bom_para, created_at) AS date) AS data_ref FROM dbo.financeiro_titulos WHERE id = @id`
            );
          if (r.recordset.length) data_ref = r.recordset[0].data_ref;
        } else {
          const r = await new sql.Request(tx)
            .input("id", sql.Int, ref_id)
            .query(
              `SELECT TOP 1 CAST(data_lancamento AS date) AS data_ref FROM dbo.bloco_lancamentos WHERE id = @id`
            );
          if (r.recordset.length) data_ref = r.recordset[0].data_ref;
        }

        const exists = await new sql.Request(tx)
          .input("ref_tipo", sql.VarChar(20), ref_tipo)
          .input("ref_id", sql.Int, ref_id)
          .query(
            `SELECT TOP 1 id FROM dbo.financeiro_conferencia WHERE ref_tipo=@ref_tipo AND ref_id=@ref_id`
          );

        const obs = status === "DIVERGENTE" ? (comentario ?? null) : null;

        if (exists.recordset.length) {
          try {
            await new sql.Request(tx)
              .input("ref_tipo", sql.VarChar(20), ref_tipo)
              .input("ref_id", sql.Int, ref_id)
              .input("status", sql.VarChar(15), status)
              .input("obs", sql.VarChar(400), obs)
              .input("conferido_por", userId)
              .input("conferido_em", status === "PENDENTE" ? null : new Date())
              .input("data_ref", data_ref)
              .query(`
                UPDATE dbo.financeiro_conferencia
                   SET status = @status,
                       obs = @obs,
                       conferido_por = @conferido_por,
                       conferido_em = @conferido_em,
                       data_ref = COALESCE(@data_ref, data_ref),
                       atualizado_em = SYSUTCDATETIME()
                 WHERE ref_tipo = @ref_tipo AND ref_id = @ref_id
              `);
          } catch (e: any) {
            await new sql.Request(tx)
              .input("ref_tipo", sql.VarChar(20), ref_tipo)
              .input("ref_id", sql.Int, ref_id)
              .input("status", sql.VarChar(15), status)
              .input("obs", sql.VarChar(400), obs)
              .input("conferido_por", userId)
              .input("conferido_em", status === "PENDENTE" ? null : new Date())
              .input("data_ref", data_ref)
              .query(`
                UPDATE dbo.financeiro_conferencia
                   SET status = @status,
                       obs = @obs,
                       conferido_por = @conferido_por,
                       conferido_em = @conferido_em,
                       data_ref = COALESCE(@data_ref, data_ref)
                 WHERE ref_tipo = @ref_tipo AND ref_id = @ref_id
              `);
          }
        } else {
          try {
            await new sql.Request(tx)
              .input("ref_tipo", sql.VarChar(20), ref_tipo)
              .input("ref_id", sql.Int, ref_id)
              .input("status", sql.VarChar(15), status)
              .input("obs", sql.VarChar(400), obs)
              .input("conferido_por", userId)
              .input("conferido_em", status === "PENDENTE" ? null : new Date())
              .input("data_ref", data_ref)
              .query(`
                INSERT INTO dbo.financeiro_conferencia
                  (ref_tipo, ref_id, status, obs, conferido_por, conferido_em, data_ref, criado_em, atualizado_em)
                VALUES
                  (@ref_tipo, @ref_id, @status, @obs, @conferido_por, @conferido_em, @data_ref, SYSUTCDATETIME(), SYSUTCDATETIME())
              `);
          } catch (e: any) {
            await new sql.Request(tx)
              .input("ref_tipo", sql.VarChar(20), ref_tipo)
              .input("ref_id", sql.Int, ref_id)
              .input("status", sql.VarChar(15), status)
              .input("obs", sql.VarChar(400), obs)
              .input("conferido_por", userId)
              .input("conferido_em", status === "PENDENTE" ? null : new Date())
              .input("data_ref", data_ref)
              .query(`
                INSERT INTO dbo.financeiro_conferencia
                  (ref_tipo, ref_id, status, obs, conferido_por, conferido_em, data_ref, criado_em)
                VALUES
                  (@ref_tipo, @ref_id, @status, @obs, @conferido_por, @conferido_em, @data_ref, SYSUTCDATETIME())
              `);
          }
        }
      }

      await tx.commit();
      return res.json({ ok: true, message: "Conferência atualizada" });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err) {
    console.error("Erro em conferenciaAtualizar:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};
