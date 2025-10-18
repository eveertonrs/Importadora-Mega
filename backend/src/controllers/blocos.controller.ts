import { Request, Response } from "express";
import { z } from "zod";
import sql from "mssql";
import { pool } from "../db";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

/* =========================================================
   Helpers
   ========================================================= */

const gerarCodigo = (clienteId: number) =>
  `B${clienteId}-${Date.now().toString(36).toUpperCase()}`;

const TIPOS_SISTEMICOS = [
  "PEDIDO",
  "DEVOLUCAO",
  "BONIFICACAO",
  "DESCONTO A VISTA",
  "TROCA",
] as const;

type TipoSistemico = (typeof TIPOS_SISTEMICOS)[number];

const sentidoBySistemico = (t: TipoSistemico): "ENTRADA" | "SAIDA" => {
  const entradas = new Set<TipoSistemico>(["BONIFICACAO", "DEVOLUCAO"]);
  return entradas.has(t) ? "ENTRADA" : "SAIDA";
};

// aceita ISO, YYYY-MM-DD e DD/MM/YYYY
function toISO(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY
  if (m1) {
    const [, dd, mm, yyyy] = m1;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
  if (m2) {
    const [, yyyy, mm, dd] = m2;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const n = Number(val.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/* =========================================================
   Schemas
   ========================================================= */

const createBlocoSchema = z.object({
  cliente_id: z.number().int("ID do cliente deve ser um inteiro"),
  codigo: z.string().optional(),
  observacao: z.string().optional(),
});

const LancStatusEnum = z.enum([
  "PENDENTE",
  "LIQUIDADO",
  "DEVOLVIDO",
  "CANCELADO",
  "BAIXADO NO FINANCEIRO",
]);

const addLancamentoSchema = z.object({
  tipo_recebimento: z.string().min(1),
  valor: z.union([z.number(), z.string()]),
  data_lancamento: z.string().min(1),
  bom_para: z.string().optional(),
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().max(60).optional(),
  status: LancStatusEnum.default("PENDENTE"),
  observacao: z.string().optional(),
});

/* =========================================================
   Controllers
   ========================================================= */

export const createBloco = async (req: Request, res: Response) => {
  try {
    const { cliente_id, codigo, observacao } = createBlocoSchema.parse(req.body);
    const finalCodigo = codigo ?? gerarCodigo(cliente_id);

    // garante 1 aberto por cliente
    const aberto = await pool
      .request()
      .input("cliente_id", sql.Int, cliente_id)
      .query(
        `SELECT TOP 1 id FROM blocos WHERE cliente_id=@cliente_id AND status='ABERTO' ORDER BY id DESC;`
      );
    if (aberto.recordset.length) {
      return res.status(409).json({
        message: "Já existe um bloco ABERTO para este cliente",
        bloco_aberto_id: aberto.recordset[0].id,
      });
    }

    const tx = pool.transaction();
    await tx.begin();

    try {
      // 1) cria o bloco
      const result = await tx
        .request()
        .input("cliente_id", sql.Int, cliente_id)
        .input("codigo", sql.VarChar(50), finalCodigo)
        .input("observacao", sql.VarChar(sql.MAX), observacao ?? null)
        .query(
          `INSERT INTO blocos (cliente_id, codigo, observacao, status, aberto_em)
           OUTPUT INSERTED.*
           VALUES (@cliente_id, @codigo, @observacao, 'ABERTO', SYSUTCDATETIME())`
        );

      const novoBloco = result.recordset[0] as {
        id: number;
        cliente_id: number;
        status: string;
        codigo: string;
      };

      // 2) último bloco FECHADO do cliente
      const lastClosed = await tx
        .request()
        .input("cliente_id", sql.Int, cliente_id)
        .query(
          `SELECT TOP 1 id
           FROM blocos
           WHERE cliente_id = @cliente_id AND status = 'FECHADO'
           ORDER BY fechado_em DESC, id DESC`
        );

      if (lastClosed.recordset.length) {
        const blocoFechadoId = Number(lastClosed.recordset[0].id);

        // saldo imediato do bloco fechado (ignora bom_para)
        const saldoRS = await tx
          .request()
          .input("bid", sql.Int, blocoFechadoId)
          .query(
            `SELECT
               COALESCE(SUM(CASE WHEN sentido='SAIDA'   AND bom_para IS NULL THEN valor ELSE 0 END),0)
             - COALESCE(SUM(CASE WHEN sentido='ENTRADA' AND bom_para IS NULL THEN valor ELSE 0 END),0) AS saldo
             FROM bloco_lancamentos
             WHERE bloco_id = @bid`
          );

        const saldoAnterior = Number(saldoRS.recordset[0]?.saldo ?? 0);

        // 3) se houver saldo a carregar, cria "SALDO ANTERIOR" no novo bloco
        if (saldoAnterior !== 0) {
          const sentido = saldoAnterior > 0 ? "SAIDA" : "ENTRADA";
          await tx
            .request()
            .input("bloco_id", sql.Int, novoBloco.id)
            .input("tipo_recebimento", sql.VarChar(30), "SALDO ANTERIOR")
            .input("valor", sql.Decimal(18, 2), Math.abs(saldoAnterior))
            .input("data_lancamento", sql.DateTime2, new Date().toISOString())
            .input("bom_para", sql.DateTime2, null)
            .input("tipo_cheque", sql.VarChar(15), null)
            .input("numero_referencia", sql.VarChar(60), `ANT-${blocoFechadoId}`)
            .input("status", sql.VarChar(30), "PENDENTE")
            .input("observacao", sql.VarChar(sql.MAX), `Saldo anterior do bloco #${blocoFechadoId}`)
            .input("sentido", sql.VarChar(10), sentido)
            .input("criado_por", sql.Int, null)
            .query(
              `INSERT INTO bloco_lancamentos
                 (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
                  numero_referencia, status, observacao, sentido, criado_por, criado_em)
               VALUES
                 (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque,
                  @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())`
            );
        }
      }

      await tx.commit();
      return res.status(201).json(novoBloco);
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if (error?.number === 2627) {
      return res.status(409).json({ message: "Já existe um bloco ABERTO com este código para o cliente" });
    }
    console.error("Erro ao criar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** Vincular pedido ao bloco (mantido) */
export const addPedidoToBloco = async (_req: Request, res: Response) => {
  return res.status(501).json({ message: "Não alterado aqui. Mantenha seu handler original." });
};

/**
 * Adiciona lançamento no bloco.
 * Se for SAÍDA + bom_para → cria título em financeiro_titulos.
 */
export const addLancamentoToBloco = async (req: AuthenticatedRequest, res: Response) => {
  const { id: bloco_id } = req.params;

  try {
    const raw = addLancamentoSchema.parse(req.body);

    // 1) bloco
    const bq = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .query("SELECT id, status, cliente_id FROM blocos WHERE id = @bloco_id");
    if (!bq.recordset.length) return res.status(404).json({ message: "Bloco não encontrado" });
    if (String(bq.recordset[0].status) !== "ABERTO")
      return res.status(400).json({ message: "Não é possível adicionar lançamento em bloco FECHADO" });
    const clienteIdDoBloco = Number(bq.recordset[0].cliente_id);

    // 2) normalizações
    const valor = toNumber(raw.valor);
    if (valor === null || valor <= 0) return res.status(400).json({ message: "Informe um valor válido (> 0)." });

    const dataISO = toISO(raw.data_lancamento);
    if (!dataISO) return res.status(400).json({ message: "Data inválida." });

    const bomParaISO = raw.bom_para ? toISO(raw.bom_para) : null;

    // 3) resolve tipo/sentido via parâmetros
    const tipoStr = String(raw.tipo_recebimento).trim().toUpperCase();

    let sentido: "ENTRADA" | "SAIDA" | null = null;
    let exigeBomPara = false;
    let exigeTipoCheque = false;

    // 3.1 tenta em pedido_parametros (fonte oficial)
    try {
      const paramRS = await pool
        .request()
        .input("desc", sql.VarChar(120), tipoStr)
        .query(
          `SELECT TOP 1 tipo, exige_bom_para, exige_tipo_cheque
           FROM dbo.pedido_parametros
           WHERE UPPER(descricao) = @desc AND ativo = 1`
        );
      if (paramRS.recordset.length) {
        const row = paramRS.recordset[0] as any;
        sentido = String(row.tipo || "").toUpperCase() === "SAIDA" ? "SAIDA" : "ENTRADA";
        exigeBomPara = !!row.exige_bom_para;
        exigeTipoCheque = !!row.exige_tipo_cheque;
      }
    } catch {}

    // 3.2 Fallback explícito
    if (!sentido) {
      const tiposSaidaComBomPara = new Set(["CHEQUE", "BOLETO"]);
      if (tiposSaidaComBomPara.has(tipoStr)) {
        sentido = "SAIDA";
        exigeBomPara = true;
        exigeTipoCheque = tipoStr === "CHEQUE";
      }
    }

    // 3.3 Último fallback (sistêmicos)
    if (!sentido) {
      if ((TIPOS_SISTEMICOS as ReadonlyArray<string>).includes(tipoStr)) {
        sentido = sentidoBySistemico(tipoStr as TipoSistemico);
      } else {
        return res.status(400).json({
          message:
            "Tipo inválido. Cadastre em 'Parâmetros do pedido' (com tipo/flags) ou use um tipo padrão reconhecido (CHEQUE/BOLETO/etc).",
        });
      }
    }

    if (exigeBomPara && !bomParaISO) return res.status(400).json({ message: "Este tipo exige 'bom_para'." });
    if (exigeTipoCheque && !raw.tipo_cheque) return res.status(400).json({ message: "Informe 'tipo_cheque'." });

    const tipoCheque = exigeTipoCheque ? (raw.tipo_cheque ?? null) : null;
    const userId = req.user?.id ?? 0;

    // 4) insere lançamento no bloco
    const insertLanc = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .input("tipo_recebimento", sql.VarChar(30), tipoStr)
      .input("valor", sql.Decimal(18, 2), valor)
      .input("data_lancamento", sql.DateTime2, dataISO)
      .input("bom_para", sql.DateTime2, bomParaISO)
      .input("tipo_cheque", sql.VarChar(15), tipoCheque)
      .input("numero_referencia", sql.VarChar(60), raw.numero_referencia ?? null)
      .input("status", sql.VarChar(30), raw.status)
      .input("observacao", sql.VarChar(sql.MAX), raw.observacao ?? null)
      .input("sentido", sql.VarChar(10), sentido)
      .input("criado_por", sql.Int, userId)
      .query(
        `INSERT INTO bloco_lancamentos
           (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
            numero_referencia, status, observacao, sentido, criado_por, criado_em)
         OUTPUT INSERTED.*
         VALUES
           (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque,
            @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())`
      );

    const lanc = insertLanc.recordset[0];

    // 5) SAÍDA + bom_para => cria Título no Financeiro
    if (sentido === "SAIDA" && bomParaISO) {
      try {
        // tentativa com bloco_lanc_id (bancos novos)
        try {
          const insTit = await pool
            .request()
            .input("cliente_id", sql.Int, clienteIdDoBloco)
            .input("tipo", sql.VarChar(20), tipoStr)
            .input("forma_id", sql.Int, null)
            .input("numero_doc", sql.VarChar(80), raw.numero_referencia ?? null)
            .input("banco", sql.VarChar(40), null)
            .input("agencia", sql.VarChar(20), null)
            .input("conta", sql.VarChar(30), null)
            .input("bom_para", sql.DateTime2, bomParaISO)
            .input("valor_bruto", sql.Decimal(18, 2), valor)
            .input("valor_baixado", sql.Decimal(18, 2), 0)
            .input("status", sql.VarChar(20), "ABERTO")
            .input("observacao", sql.VarChar(400), raw.observacao ?? null)
            .input("bloco_id", sql.Int, +bloco_id)
            .input("bloco_lanc_id", sql.Int, Number(lanc.id) || null)
            .input("created_by", sql.Int, userId)
            .query(
              `INSERT INTO dbo.financeiro_titulos
                 (cliente_id, tipo, forma_id, numero_doc, banco, agencia, conta, bom_para,
                  valor_bruto, valor_baixado, status, observacao, bloco_id, bloco_lanc_id,
                  created_by, created_at)
               OUTPUT INSERTED.id
               VALUES
                 (@cliente_id, @tipo, @forma_id, @numero_doc, @banco, @agencia, @conta, @bom_para,
                  @valor_bruto, @valor_baixado, @status, @observacao, @bloco_id, @bloco_lanc_id,
                  @created_by, SYSUTCDATETIME());`
            );
          (lanc as any).titulo_id = insTit.recordset[0]?.id ?? null;
        } catch (err: any) {
          // fallback: banco antigo (sem bloco_lanc_id)
          const msg = String(err?.message || "");
          const number = (err?.number ?? err?.originalError?.number) as number | undefined;
          const invalidColumn =
            number === 207 || /Invalid column name/i.test(msg) || /bloco_lanc_id/i.test(msg);

          if (!invalidColumn) throw err;

          const insTit2 = await pool
            .request()
            .input("cliente_id", sql.Int, clienteIdDoBloco)
            .input("tipo", sql.VarChar(20), tipoStr)
            .input("forma_id", sql.Int, null)
            .input("numero_doc", sql.VarChar(80), raw.numero_referencia ?? null)
            .input("banco", sql.VarChar(40), null)
            .input("agencia", sql.VarChar(20), null)
            .input("conta", sql.VarChar(30), null)
            .input("bom_para", sql.DateTime2, bomParaISO)
            .input("valor_bruto", sql.Decimal(18, 2), valor)
            .input("valor_baixado", sql.Decimal(18, 2), 0)
            .input("status", sql.VarChar(20), "ABERTO")
            .input("observacao", sql.VarChar(400), raw.observacao ?? null)
            .input("bloco_id", sql.Int, +bloco_id)
            .input("created_by", sql.Int, userId)
            .query(
              `INSERT INTO dbo.financeiro_titulos
                 (cliente_id, tipo, forma_id, numero_doc, banco, agencia, conta, bom_para,
                  valor_bruto, valor_baixado, status, observacao, bloco_id, created_by, created_at)
               OUTPUT INSERTED.id
               VALUES
                 (@cliente_id, @tipo, @forma_id, @numero_doc, @banco, @agencia, @conta, @bom_para,
                  @valor_bruto, @valor_baixado, @status, @observacao, @bloco_id, @created_by, SYSUTCDATETIME());`
            );
          (lanc as any).titulo_id = insTit2.recordset[0]?.id ?? null;
        }
      } catch (e) {
        console.error("Falha ao criar título financeiro (financeiro_titulos):", e);
        // não falha o endpoint; o lançamento do bloco foi criado
      }
    }

    return res.status(201).json(lanc);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao adicionar lançamento ao bloco:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** Saldo legado (mantido) */
export const getBlocoSaldo = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rs = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(
        `SELECT
           @bloco_id AS bloco_id,
           COALESCE(SUM(CASE WHEN sentido = 'SAIDA'   THEN valor ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN sentido = 'ENTRADA' THEN valor ELSE 0 END), 0) AS saldo
         FROM bloco_lancamentos
         WHERE bloco_id = @bloco_id`
      );

    const exists = await pool.request()
      .input("bloco_id", sql.Int, +id)
      .query(`SELECT 1 FROM blocos WHERE id = @bloco_id`);
    if (!exists.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }

    res.json(rs.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar saldo do bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/**
 * Saldos novos:
 * - saldo_bloco      = TODAS as movimentações (inclui bom_para) → SAÍDA - ENTRADA
 * - saldo_imediato   = SOMENTE movimentações imediatas (bom_para IS NULL)
 * - a_receber        = Σ (valor_bruto - valor_baixado) dos títulos ABERTO/PARCIAL do bloco
 * - saldo_financeiro = saldo_imediato + Σ valor_baixado de títulos do bloco
 */
export const getBlocoSaldos = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const exists = await pool.request()
      .input("bloco_id", sql.Int, +id)
      .query(`SELECT TOP 1 id, cliente_id FROM blocos WHERE id = @bloco_id`);
    if (!exists.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }

    // saldo do bloco (todas as movimentações)
    const saldoBlocoRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(
        `SELECT
           COALESCE(SUM(CASE WHEN sentido='SAIDA'   THEN valor ELSE 0 END),0)
         - COALESCE(SUM(CASE WHEN sentido='ENTRADA' THEN valor ELSE 0 END),0) AS saldo_bloco
         FROM bloco_lancamentos
         WHERE bloco_id = @bloco_id`
      );
    const saldo_bloco = Number(saldoBlocoRS.recordset[0]?.saldo_bloco ?? 0);

    // saldo imediato (ignora bom_para)
    const saldoImediatoRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(
        `SELECT
           COALESCE(SUM(CASE WHEN sentido='SAIDA'   AND bom_para IS NULL THEN valor ELSE 0 END),0)
         - COALESCE(SUM(CASE WHEN sentido='ENTRADA' AND bom_para IS NULL THEN valor ELSE 0 END),0) AS saldo_imediato
         FROM bloco_lancamentos
         WHERE bloco_id = @bloco_id`
      );
    const saldo_imediato = Number(saldoImediatoRS.recordset[0]?.saldo_imediato ?? 0);

    // a receber (títulos do bloco)
    const aRecRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(
        `SELECT COALESCE(SUM(valor_bruto - valor_baixado), 0) AS a_receber
         FROM dbo.financeiro_titulos
         WHERE bloco_id = @bloco_id
           AND status IN ('ABERTO','PARCIAL')`
      );
    const a_receber = Number(aRecRS.recordset[0]?.a_receber ?? 0);

    // títulos baixados (somatório do que entrou via baixa)
    const baixadosRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(
        `SELECT COALESCE(SUM(valor_baixado), 0) AS total_baixado
         FROM dbo.financeiro_titulos
         WHERE bloco_id = @bloco_id
           AND valor_baixado > 0`
      );
    const total_baixado = Number(baixadosRS.recordset[0]?.total_baixado ?? 0);

    const saldo_financeiro = saldo_imediato + total_baixado;

    res.json({ bloco_id: Number(id), saldo_bloco, saldo_imediato, a_receber, saldo_financeiro });
  } catch (error) {
    console.error("Erro em getBlocoSaldos:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const fecharBloco = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // saldo imediato no fechamento (informativo)
    const saldoRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(
        `SELECT b.id, b.cliente_id,
          (
            COALESCE((SELECT SUM(valor) FROM bloco_lancamentos WHERE bloco_id = b.id AND sentido = 'SAIDA'   AND bom_para IS NULL), 0)
            -
            COALESCE((SELECT SUM(valor) FROM bloco_lancamentos WHERE bloco_id = b.id AND sentido = 'ENTRADA' AND bom_para IS NULL), 0)
          ) AS saldo
        FROM blocos b
        WHERE b.id = @bloco_id`
      );

    if (!saldoRS.recordset.length) return res.status(404).json({ message: "Bloco não encontrado" });

    const result = await pool
      .request()
      .input("id", sql.Int, +id)
      .query(
        `UPDATE blocos
         SET status = 'FECHADO', fechado_em = SYSUTCDATETIME()
         OUTPUT INSERTED.*
         WHERE id = @id AND status = 'ABERTO'`
      );

    if (!result.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado ou já está fechado" });
    }

    res.json({ ...result.recordset[0] });
  } catch (error) {
    console.error("Erro ao fechar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ===== Listagens (mantidas) ===== */

const listBlocosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  status: z.enum(["ABERTO", "FECHADO"]).optional(),
  cliente_id: z.coerce.number().int().optional(),
  cliente: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const listBlocos = async (req: Request, res: Response) => {
  try {
    const { page, limit, status, cliente_id, cliente, search } =
      listBlocosQuerySchema.parse(req.query);
    const offset = (page - 1) * limit;

    const where: string[] = [];
    if (status) where.push("b.status = @status");
    if (cliente_id) where.push("b.cliente_id = @cliente_id");
    if (cliente) where.push("c.nome_fantasia LIKE '%' + @cliente + '%'");
    if (search) where.push("(b.codigo LIKE '%' + @search + '%')");

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const totalReq = pool.request();
    if (status) totalReq.input("status", status);
    if (cliente_id) totalReq.input("cliente_id", cliente_id);
    if (cliente) totalReq.input("cliente", cliente);
    if (search) totalReq.input("search", search);

    const totalRs = await totalReq.query(
      `SELECT COUNT(*) AS total
       FROM blocos b
       LEFT JOIN clientes c ON c.id = b.cliente_id
       ${whereSql}`
    );
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    const pageReq = pool.request().input("limit", limit).input("offset", offset);
    if (status) pageReq.input("status", status);
    if (cliente_id) pageReq.input("cliente_id", cliente_id);
    if (cliente) pageReq.input("cliente", cliente);
    if (search) pageReq.input("search", search);

    const rs = await pageReq.query(
      `SELECT
         b.id, b.codigo, b.status, b.cliente_id, c.nome_fantasia AS cliente_nome,
         b.aberto_em, b.fechado_em, b.observacao
       FROM blocos b
       LEFT JOIN clientes c ON c.id = b.cliente_id
       ${whereSql}
       ORDER BY b.id DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`
    );

    return res.json({ data: rs.recordset, page, limit, total });
  } catch (err) {
    console.error("Erro em listBlocos:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getBlocoById = async (req: Request, res: Response) => {
  try {
    const bloco_id = +req.params.id;

    const rs = await pool
      .request()
      .input("id", bloco_id)
      .query(
        `SELECT
           b.id, b.codigo, b.status, b.cliente_id, c.nome_fantasia AS cliente_nome,
           b.aberto_em, b.fechado_em, b.observacao
         FROM blocos b
         LEFT JOIN clientes c ON c.id = b.cliente_id
         WHERE b.id = @id`
      );

    if (!rs.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error("Erro em getBlocoById:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const listLancQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  status: z.enum(["PENDENTE","LIQUIDADO","DEVOLVIDO","CANCELADO","BAIXADO NO FINANCEIRO"]).optional(),
  tipo: z.string().optional(),
});

export const listLancamentosDoBloco = async (req: Request, res: Response) => {
  try {
    const bloco_id = +req.params.id;
    const { page, limit, status, tipo } = listLancQuerySchema.parse(req.query);
    const offset = (page - 1) * limit;

    const where: string[] = ["l.bloco_id = @bloco_id"];
    const reqDb = pool.request().input("bloco_id", bloco_id);
    if (status) { where.push("l.status = @status"); reqDb.input("status", status); }
    if (tipo)   { where.push("l.tipo_recebimento = @tipo"); reqDb.input("tipo", tipo.toUpperCase()); }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const totalRs = await reqDb.query(
      `SELECT COUNT(*) AS total
       FROM bloco_lancamentos l
       ${whereSql}`
    );
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    const pageReq = pool
      .request()
      .input("bloco_id", bloco_id).input("limit", limit).input("offset", offset);
    if (status) pageReq.input("status", status);
    if (tipo) pageReq.input("tipo", tipo.toUpperCase());

    const rs = await pageReq.query(
      `SELECT
         l.id, l.bloco_id, l.tipo_recebimento, l.sentido, l.valor,
         l.data_lancamento, l.bom_para, l.tipo_cheque, l.numero_referencia,
         l.status, l.observacao, l.criado_por, l.criado_em,
         l.referencia_pedido_id, l.referencia_lancamento_id,
         u.nome AS criado_por_nome
       FROM bloco_lancamentos l
       LEFT JOIN dbo.usuarios u ON u.id = l.criado_por
       ${whereSql}
       ORDER BY l.id DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`
    );

    return res.json({ data: rs.recordset, page, limit, total });
  } catch (err) {
    console.error("Erro em listLancamentosDoBloco:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* Excluir lançamento: ver regras no comentário */
export const deleteLancamento = async (req: Request, res: Response) => {
  const bloco_id = +req.params.id;
  const lanc_id = +req.params.lanc_id;

  if (!Number.isFinite(bloco_id) || !Number.isFinite(lanc_id)) {
    return res.status(400).json({ message: "Parâmetros inválidos" });
  }

  try {
    const blocoRS = await pool.request().input("id", sql.Int, bloco_id)
      .query(`SELECT id, status FROM blocos WHERE id = @id`);
    if (!blocoRS.recordset.length) return res.status(404).json({ message: "Bloco não encontrado" });
    if (String(blocoRS.recordset[0].status) !== "ABERTO") {
      return res.status(400).json({ message: "Não é possível excluir lançamento de bloco FECHADO" });
    }

    const lancRS = await pool.request()
      .input("id", sql.Int, lanc_id)
      .input("bloco_id", sql.Int, bloco_id)
      .query(
        `SELECT id, bloco_id, bom_para
         FROM bloco_lancamentos
         WHERE id = @id AND bloco_id = @bloco_id`
      );
    if (!lancRS.recordset.length) return res.status(404).json({ message: "Lançamento não encontrado" });

    const bom_para = lancRS.recordset[0].bom_para as Date | null;
    if (bom_para) {
      return res.status(409).json({
        message:
          "Este lançamento possui 'bom para' (gera/gerou Título a receber). Exclua/ajuste o título correspondente antes de remover o lançamento."
      });
    }

    await pool.request()
      .input("id", sql.Int, lanc_id)
      .input("bloco_id", sql.Int, bloco_id)
      .query(`DELETE FROM bloco_lancamentos WHERE id = @id AND bloco_id = @bloco_id`);

    return res.status(204).send();
  } catch (err) {
    console.error("Erro em deleteLancamento:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const listPedidosDoBloco = async (_req: Request, res: Response) => {
  return res.status(501).json({ message: "Não alterado aqui. Mantenha seu handler original." });
};

export const unlinkPedido = async (_req: AuthenticatedRequest, res: Response) => {
  return res.status(501).json({ message: "Não alterado aqui. Mantenha seu handler original." });
};
