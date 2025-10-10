import { Request, Response } from "express";
import { z } from "zod";
import sql from "mssql";
import { pool, dbConfig } from "../db";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

/* =========================================================
   Helpers
   ========================================================= */

const gerarCodigo = (clienteId: number) =>
  `B${clienteId}-${Date.now().toString(36).toUpperCase()}`;

/** Tipos “do sistema” que não dependem de cadastro */
const TIPOS_SISTEMICOS = [
  "PEDIDO",
  "DEVOLUCAO",
  "BONIFICACAO",
  "DESCONTO A VISTA",
  "TROCA",
] as const;

type TipoSistemico = (typeof TIPOS_SISTEMICOS)[number];

/** Mapeia um tipo “sistêmico” para o sentido */
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

  const d = new Date(s); // tenta parse natural/ISO
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

/* ---------- “Crédito do cliente” em auditoria_logs (sem mexer no schema) ---------- */

async function findPendingCredito(
  clienteId: number
): Promise<{ log_id: number; valor: number } | null> {
  const rs = await pool
    .request()
    .input("entidade", sql.VarChar(50), "credito_cliente")
    .input("entidade_id", sql.VarChar(50), String(clienteId))
    .query(`
      ;WITH gerados AS (
        SELECT l.id, l.payload_json
        FROM auditoria_logs l
        WHERE l.entidade = @entidade
          AND l.entidade_id = @entidade_id
          AND l.acao = 'GERADO'
      ),
      consumidos AS (
        SELECT JSON_VALUE(c.payload_json, '$.orig_log_id') AS orig_id_str
        FROM auditoria_logs c
        WHERE c.entidade = @entidade
          AND c.entidade_id = @entidade_id
          AND c.acao = 'CONSUMIDO'
      )
      SELECT TOP 1 g.id AS log_id,
             TRY_CONVERT(decimal(18,2), JSON_VALUE(g.payload_json, '$.valor')) AS valor
      FROM gerados g
      WHERE NOT EXISTS (
        SELECT 1
        FROM consumidos c
        WHERE c.orig_id_str = CONVERT(varchar(20), g.id)
      )
      ORDER BY g.id DESC;
    `);

  const row = rs.recordset[0];
  if (!row) return null;
  const valor = Number(row.valor ?? 0);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { log_id: Number(row.log_id), valor };
}

async function logCreditoGerado(clienteId: number, blocoId: number, valor: number) {
  await pool
    .request()
    .input("usuario_id", sql.Int, null)
    .input("entidade", sql.VarChar(50), "credito_cliente")
    .input("entidade_id", sql.VarChar(50), String(clienteId))
    .input("acao", sql.VarChar(20), "GERADO")
    .input(
      "payload_json",
      sql.NVarChar(sql.MAX),
      JSON.stringify({
        valor,
        bloco_id: blocoId,
        gerado_em_utc: new Date().toISOString(),
      })
    )
    .query(`
      INSERT INTO auditoria_logs (usuario_id, entidade, entidade_id, acao, payload_json, criado_em)
      VALUES (@usuario_id, @entidade, @entidade_id, @acao, @payload_json, SYSUTCDATETIME());
    `);
}

async function logCreditoConsumido(
  clienteId: number,
  origLogId: number,
  blocoId: number,
  valor: number
) {
  await pool
    .request()
    .input("usuario_id", sql.Int, null)
    .input("entidade", sql.VarChar(50), "credito_cliente")
    .input("entidade_id", sql.VarChar(50), String(clienteId))
    .input("acao", sql.VarChar(20), "CONSUMIDO")
    .input(
      "payload_json",
      sql.NVarChar(sql.MAX),
      JSON.stringify({
        orig_log_id: String(origLogId),
        bloco_id: blocoId,
        valor,
        consumido_em_utc: new Date().toISOString(),
      })
    )
    .query(`
      INSERT INTO auditoria_logs (usuario_id, entidade, entidade_id, acao, payload_json, criado_em)
      VALUES (@usuario_id, @entidade, @entidade_id, @acao, @payload_json, SYSUTCDATETIME());
    `);
}

/* ---------- “Débito do cliente” (simétrico ao crédito) ---------- */

async function findPendingDebito(
  clienteId: number
): Promise<{ log_id: number; valor: number } | null> {
  const rs = await pool
    .request()
    .input("entidade", sql.VarChar(50), "debito_cliente")
    .input("entidade_id", sql.VarChar(50), String(clienteId))
    .query(`
      ;WITH gerados AS (
        SELECT l.id, TRY_CONVERT(decimal(18,2), JSON_VALUE(l.payload_json, '$.valor')) AS valor
        FROM auditoria_logs l
        WHERE l.entidade = @entidade
          AND l.entidade_id = @entidade_id
          AND l.acao = 'GERADO'
      ),
      consumidos AS (
        SELECT JSON_VALUE(c.payload_json, '$.orig_log_id') AS orig_id_str
        FROM auditoria_logs c
        WHERE c.entidade = @entidade
          AND c.entidade_id = @entidade_id
          AND c.acao = 'CONSUMIDO'
      )
      SELECT TOP 1 g.id AS log_id, g.valor
      FROM gerados g
      WHERE g.valor > 0
        AND NOT EXISTS (
          SELECT 1 FROM consumidos c
          WHERE c.orig_id_str = CONVERT(varchar(20), g.id)
        )
      ORDER BY g.id DESC;
    `);

  const row = rs.recordset[0];
  if (!row) return null;
  const valor = Number(row.valor ?? 0);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { log_id: Number(row.log_id), valor };
}

// ---------- DÉBITO do cliente (simétrico ao crédito) ----------
async function logDebitoGerado(
  clienteId: number,
  blocoId: number,
  valor: number
) {
  await pool
    .request()
    .input("usuario_id", sql.Int, null)
    .input("entidade", sql.VarChar(50), "debito_cliente")
    .input("entidade_id", sql.VarChar(50), String(clienteId))
    .input("acao", sql.VarChar(20), "GERADO")
    .input(
      "payload_json",
      sql.NVarChar(sql.MAX),
      JSON.stringify({
        valor,
        bloco_id: blocoId,
        gerado_em_utc: new Date().toISOString(),
      })
    )
    .query(`
      INSERT INTO auditoria_logs (usuario_id, entidade, entidade_id, acao, payload_json, criado_em)
      VALUES (@usuario_id, @entidade, @entidade_id, @acao, @payload_json, SYSUTCDATETIME());
    `);
}

async function logDebitoConsumido(
  clienteId: number,
  origLogId: number,
  blocoId: number,
  valor: number
) {
  await pool
    .request()
    .input("usuario_id", sql.Int, null)
    .input("entidade", sql.VarChar(50), "debito_cliente")
    .input("entidade_id", sql.VarChar(50), String(clienteId))
    .input("acao", sql.VarChar(20), "CONSUMIDO")
    .input(
      "payload_json",
      sql.NVarChar(sql.MAX),
      JSON.stringify({
        orig_log_id: String(origLogId),
        bloco_id: blocoId,
        valor,
        consumido_em_utc: new Date().toISOString(),
      })
    )
    .query(`
      INSERT INTO auditoria_logs (usuario_id, entidade, entidade_id, acao, payload_json, criado_em)
      VALUES (@usuario_id, @entidade, @entidade_id, @acao, @payload_json, SYSUTCDATETIME());
    `);
}


/* =========================================================
   Schemas (entrada crua)
   ========================================================= */

const createBlocoSchema = z.object({
  cliente_id: z.number().int("ID do cliente deve ser um inteiro"),
  codigo: z.string().optional(),
  observacao: z.string().optional(),
});

/**
 * Vincular pedido: aceita OU um ID numérico OU uma referência textual.
 * `permitir_duplicado` foi removido daqui porque não está sendo usado agora.
 */
const addPedidoSchema = z
  .object({
    pedido_id: z.number().int("ID do pedido deve ser inteiro").optional(),
    pedido_ref: z.string().trim().min(1).max(60).optional(),
    valor_pedido: z.coerce.number().positive().optional(),
    descricao: z.string().trim().max(300).optional(),
  })
  .refine((d) => !!d.pedido_id || !!d.pedido_ref, {
    message: "Informe 'pedido_id' (número) ou 'pedido_ref' (texto).",
  });

/** Agora o tipo_recebimento aceita string (dinâmico). */
const addLancamentoSchema = z.object({
  tipo_recebimento: z.string().min(1, "tipo_recebimento é obrigatório"),
  valor: z.union([z.number(), z.string()]),
  data_lancamento: z.string().min(1, "data_lancamento é obrigatório"),
  bom_para: z.string().optional(),
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().max(60, "Máximo de 60 caracteres").optional(),
  status: z
    .enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"])
    .default("PENDENTE"),
  observacao: z.string().optional(),
});

/* =========================================================
   Controllers
   ========================================================= */

export const createBloco = async (req: Request, res: Response) => {
  try {
    const { cliente_id, codigo, observacao } = createBlocoSchema.parse(req.body);
    const finalCodigo = codigo ?? gerarCodigo(cliente_id);

    // (1) garantir 1 ABERTO por cliente
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

    // (2) cria bloco
    const result = await pool
      .request()
      .input("cliente_id", sql.Int, cliente_id)
      .input("codigo", sql.VarChar(50), finalCodigo)
      .input("observacao", sql.VarChar(sql.MAX), observacao ?? null)
      .query(`
        INSERT INTO blocos (cliente_id, codigo, observacao, status, aberto_em)
        OUTPUT INSERTED.*
        VALUES (@cliente_id, @codigo, @observacao, 'ABERTO', SYSUTCDATETIME())
      `);

    const bloco = result.recordset[0] as { id: number; cliente_id: number };

    // (3a) consumir CRÉDITO pendente (se houver) -> SAÍDA (CRED-ANT)  ✅ (mantido)
    const pend = await findPendingCredito(cliente_id);
    if (pend) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        await new sql.Request(tx)
          .input("bloco_id", sql.Int, bloco.id)
          .input("tipo_recebimento", sql.VarChar(30), "BONIFICACAO")
          .input("valor", sql.Decimal(18, 2), pend.valor)
          .input("data_lancamento", sql.DateTime2, new Date().toISOString())
          .input("bom_para", sql.DateTime2, null)
          .input("tipo_cheque", sql.VarChar(15), null)
          .input("numero_referencia", sql.VarChar(60), `CRED-ANT-${pend.log_id}`)
          .input("status", sql.VarChar(15), "PENDENTE")
          .input("observacao", sql.VarChar(sql.MAX), "Crédito bloco anterior (consumido)")
          .input("sentido", sql.VarChar(10), "SAIDA")
          .input("criado_por", sql.Int, null)
          .query(`
            INSERT INTO bloco_lancamentos
              (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
               numero_referencia, status, observacao, sentido, criado_por, criado_em)
            VALUES
              (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque,
               @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())
          `);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        console.error("Falha ao consumir crédito pendente na abertura do bloco:", e);
      }
      try {
        await logCreditoConsumido(cliente_id, pend.log_id, bloco.id, pend.valor);
      } catch (e) {
        console.error("Falha ao logar consumo de crédito:", e);
      }
    }

    // (3b) consumir DÉBITO pendente (se houver) -> **ENTRADA** (DEB-ANT)
    const pendDeb = await findPendingDebito(cliente_id);
    if (pendDeb) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        await new sql.Request(tx)
          .input("bloco_id", sql.Int, bloco.id)
          .input("tipo_recebimento", sql.VarChar(30), "PEDIDO")
          .input("valor", sql.Decimal(18, 2), pendDeb.valor)
          .input("data_lancamento", sql.DateTime2, new Date().toISOString())
          .input("bom_para", sql.DateTime2, null)
          .input("tipo_cheque", sql.VarChar(15), null)
          .input("numero_referencia", sql.VarChar(60), `DEB-ANT-${pendDeb.log_id}`)
          .input("status", sql.VarChar(15), "PENDENTE")
          .input("observacao", sql.VarChar(sql.MAX), "Débito bloco anterior (consumido)")
          .input("sentido", sql.VarChar(10), "ENTRADA")
          .input("criado_por", sql.Int, null)
          .query(`
            INSERT INTO bloco_lancamentos
              (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
               numero_referencia, status, observacao, sentido, criado_por, criado_em)
            VALUES
              (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque,
               @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())
          `);
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        console.error("Falha ao consumir débito pendente na abertura do bloco:", e);
      }
      try {
        await logDebitoConsumido(cliente_id, pendDeb.log_id, bloco.id, pendDeb.valor);
      } catch (e) {
        console.error("Falha ao logar consumo de débito:", e);
      }
    }

    res.status(201).json(result.recordset[0]);
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

/**
 * Vincula um pedido ao bloco.
 */
export const addPedidoToBloco = async (req: AuthenticatedRequest, res: Response) => {
  const { id: bloco_id } = req.params;

  try {
    const { pedido_id, pedido_ref, valor_pedido, descricao } = addPedidoSchema.parse(req.body);
    const userId = req.user?.id ?? null;

    // bloco válido/aberto?
    const b = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .query("SELECT id, status, cliente_id FROM blocos WHERE id = @bloco_id");
    if (!b.recordset.length) return res.status(404).json({ message: "Bloco não encontrado" });
    if (b.recordset[0].status !== "ABERTO")
      return res.status(400).json({ message: "Não é possível adicionar pedido em bloco FECHADO" });

    // --- CASO 1: referência LIVRE (string) -> lançamento PEDIDO (SAÍDA) ---
    if (!pedido_id && pedido_ref) {
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        await new sql.Request(tx)
          .input("bloco_id", sql.Int, +bloco_id)
          .input("tipo_recebimento", sql.VarChar(30), "PEDIDO")
          .input("valor", sql.Decimal(18, 2), valor_pedido ?? 0)
          .input("data_lancamento", sql.DateTime2, new Date().toISOString())
          .input("numero_referencia", sql.VarChar(60), pedido_ref)
          .input("status", sql.VarChar(15), "PENDENTE")
          .input("observacao", sql.VarChar(sql.MAX), descricao ?? "Débito de pedido (ref livre)")
          .input("sentido", sql.VarChar(10), "SAIDA")
          .input("criado_por", sql.Int, userId)
          .query(`
            INSERT INTO bloco_lancamentos
              (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
               numero_referencia, status, observacao, sentido, criado_por, criado_em)
            VALUES
              (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, NULL, NULL,
               @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())
          `);

        await tx.commit();
        return res.status(201).json({
          message: "Lançamento de PEDIDO criado (referência livre).",
          data: null,
          lancamento_gerado: true,
          modo: "ref_livre",
        });
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    }

    // --- CASO 2: ID numérico -> tenta vincular ---
    // já vinculado em algum bloco?
    const v = await pool
      .request()
      .input("pedido_id", sql.Int, pedido_id!)
      .query("SELECT 1 FROM bloco_pedidos WHERE pedido_id = @pedido_id");
    if (v.recordset.length) {
      return res.status(409).json({
        code: "ALREADY_LINKED",
        message: "Pedido já está vinculado a outro bloco.",
      });
    }

    // o pedido existe?
    const ped = await pool
      .request()
      .input("pedido_id", sql.Int, pedido_id!)
      .query("SELECT id FROM pedidos WHERE id = @pedido_id");

    let espelhado = false;

    // se não existir, tenta espelhar com o MESMO id (IDENTITY_INSERT)
    if (!ped.recordset.length) {
      const dedicated = await new sql.ConnectionPool(dbConfig).connect();
      const tx = new sql.Transaction(dedicated);
      try {
        await tx.begin();

        await new sql.Request(tx).query("SET IDENTITY_INSERT dbo.pedidos ON;");
        await new sql.Request(tx)
          .input("id", sql.Int, pedido_id!)
          .input("cliente_id", sql.Int, b.recordset[0].cliente_id)
          .input("valor_total", sql.Decimal(18, 2), valor_pedido ?? 0)
          .query(`
            INSERT INTO dbo.pedidos (id, cliente_id, valor_total, data_pedido)
            VALUES (@id, @cliente_id, @valor_total, CAST(SYSUTCDATETIME() AS date));
          `);
        await new sql.Request(tx).query("SET IDENTITY_INSERT dbo.pedidos OFF;");

        await tx.commit();
        espelhado = true;
      } catch (e: any) {
        try { await tx.rollback(); } catch {}
        await dedicated.close();

        // ---- FALLBACK: falhou o espelho -> cria só o lançamento “PEDIDO” com a ref numérica ----
        const tx2 = new sql.Transaction(pool);
        await tx2.begin();
        try {
          await new sql.Request(tx2)
            .input("bloco_id", sql.Int, +bloco_id)
            .input("tipo_recebimento", sql.VarChar(30), "PEDIDO")
            .input("valor", sql.Decimal(18, 2), valor_pedido ?? 0)
            .input("data_lancamento", sql.DateTime2, new Date().toISOString())
            .input("numero_referencia", sql.VarChar(60), String(pedido_id))
            .input("status", sql.VarChar(15), "PENDENTE")
            .input("observacao", sql.VarChar(sql.MAX), "Débito de pedido (fallback sem vínculo)")
            .input("sentido", sql.VarChar(10), "SAIDA")
            .input("criado_por", sql.Int, userId)
            .query(`
              INSERT INTO bloco_lancamentos
                (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
                 numero_referencia, status, observacao, sentido, criado_por, criado_em)
              VALUES
                (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, NULL, NULL,
                 @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())
            `);

          await tx2.commit();
          return res.status(201).json({
            code: "FALLBACK_LANC",
            message: "Falha ao espelhar pedido; criado lançamento de PEDIDO sem vínculo.",
            data: null,
            lancamento_gerado: true,
            modo: "fallback_sem_vinculo",
          });
        } catch (e2) {
          await tx2.rollback();
          return res.status(500).json({
            message: "Falha ao espelhar o pedido e ao criar fallback.",
            error: e2 instanceof Error ? e2.message : String(e2),
          });
        }
      }
      await dedicated.close();
    }

    // vincula e gera lançamento (se informado valor)
    const tx3 = new sql.Transaction(pool);
    await tx3.begin();
    try {
      const vinculo = await new sql.Request(tx3)
        .input("bloco_id", sql.Int, +bloco_id)
        .input("pedido_id", sql.Int, pedido_id!)
        .query(`
          INSERT INTO bloco_pedidos (bloco_id, pedido_id)
          OUTPUT INSERTED.*
          VALUES (@bloco_id, @pedido_id)
        `);

      let lancGerado = false;
      if (valor_pedido && valor_pedido > 0) {
        await new sql.Request(tx3)
          .input("bloco_id", sql.Int, +bloco_id)
          .input("tipo_recebimento", sql.VarChar(30), "PEDIDO")
          .input("valor", sql.Decimal(18, 2), valor_pedido)
          .input("data_lancamento", sql.DateTime2, new Date().toISOString())
          .input("numero_referencia", sql.VarChar(60), String(pedido_id))
          .input("status", sql.VarChar(15), "PENDENTE")
          .input("observacao", sql.VarChar(sql.MAX), descricao ?? "Débito automático do pedido")
          .input("sentido", sql.VarChar(10), "SAIDA")
          .input("criado_por", sql.Int, userId)
          .query(`
            INSERT INTO bloco_lancamentos
              (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
               numero_referencia, status, observacao, sentido, criado_por, criado_em)
            VALUES
              (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, NULL, NULL,
               @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())
          `);
        lancGerado = true;
      }

      await tx3.commit();
      return res.status(201).json({
        message: `Pedido vinculado ao bloco com sucesso${espelhado ? " (espelhado)" : ""}`,
        data: vinculo.recordset[0],
        lancamento_gerado: lancGerado,
        modo: "vinculo",
      });
    } catch (e) {
      await tx3.rollback();
      throw e;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao adicionar pedido ao bloco:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/**
 * Adiciona lançamento:
 * - `tipo_recebimento` é DINÂMICO. Primeiro tenta achar em `pedido_parametros` (ativo);
 * - Se achar, usa o `tipo` (ENTRADA/SAIDA) para o `sentido`;
 * - Se não achar, aceita um dos TIPOS_SISTEMICOS como fallback;
 * - Regras de CHEQUE permanecem iguais.
 * - NOVO: quando for SAÍDA **com `bom_para`**, cria também um TÍTULO em `financeiro_titulos`
 *         e esse lançamento **não entra** no saldo principal (será somado em “a receber”).
 */
export const addLancamentoToBloco = async (req: AuthenticatedRequest, res: Response) => {
  const { id: bloco_id } = req.params;

  try {
    const raw = addLancamentoSchema.parse(req.body);

    // Verifica se o bloco existe e está ABERTO + pegamos cliente_id
    const bq = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .query("SELECT id, status, cliente_id FROM blocos WHERE id = @bloco_id");
    if (!bq.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }
    if (String(bq.recordset[0].status) !== "ABERTO") {
      return res.status(400).json({ message: "Não é possível adicionar lançamento em bloco FECHADO" });
    }
    const clienteIdDoBloco = Number(bq.recordset[0].cliente_id);

    // normalizações
    const valor = toNumber(raw.valor);
    if (valor === null || valor <= 0) {
      return res.status(400).json({ message: "Informe um valor numérico válido (> 0)." });
    }

    const dataISO = toISO(raw.data_lancamento);
    if (!dataISO) {
      return res.status(400).json({ message: "Data inválida. Use DD/MM/YYYY, YYYY-MM-DD ou ISO." });
    }

    const bomParaISO = raw.bom_para ? toISO(raw.bom_para) : null;

    // Resolve TIPO e SENTIDO
    const tipoStr = String(raw.tipo_recebimento).trim().toUpperCase();

    // tenta encontrar em pedido_parametros (dinâmico)
    const paramRS = await pool
      .request()
      .input("desc", sql.VarChar(120), tipoStr)
      .query(`
        SELECT TOP 1 tipo
        FROM pedido_parametros
        WHERE UPPER(descricao) = @desc AND ativo = 1
      `);

    let sentido: "ENTRADA" | "SAIDA";
    if (paramRS.recordset.length) {
      const t = String(paramRS.recordset[0].tipo).toUpperCase();
      sentido = t === "SAIDA" ? "SAIDA" : "ENTRADA";
    } else if ((TIPOS_SISTEMICOS as ReadonlyArray<string>).includes(tipoStr)) {
      sentido = sentidoBySistemico(tipoStr as TipoSistemico);
    } else {
      return res.status(400).json({
        message:
          "Tipo inválido. Selecione um parâmetro ativo em 'Parâmetros do pedido' ou use um tipo padrão (PEDIDO, DEVOLUCAO, BONIFICACAO, DESCONTO A VISTA, TROCA).",
      });
    }

    // regras para CHEQUE
    if (tipoStr === "CHEQUE") {
      if (!raw.tipo_cheque) {
        return res.status(400).json({ message: "tipo_cheque é obrigatório para CHEQUE." });
      }
      if (!bomParaISO) {
        return res.status(400).json({ message: "bom_para é obrigatório para CHEQUE." });
      }
    }

    const tipoCheque = tipoStr === "CHEQUE" ? raw.tipo_cheque ?? null : null;
    const userId = req.user?.id ?? null;

    // Inserção do lançamento (sempre registramos, mas será excluído do saldo se tiver bom_para)
    const result = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .input("tipo_recebimento", sql.VarChar(30), tipoStr)
      .input("valor", sql.Decimal(18, 2), valor)
      .input("data_lancamento", sql.DateTime2, dataISO)
      .input("bom_para", sql.DateTime2, bomParaISO)
      .input("tipo_cheque", sql.VarChar(15), tipoCheque)
      .input("numero_referencia", sql.VarChar(60), raw.numero_referencia ?? null)
      .input("status", sql.VarChar(15), raw.status)
      .input("observacao", sql.VarChar(sql.MAX), raw.observacao ?? null)
      .input("sentido", sql.VarChar(10), sentido)
      .input("criado_por", sql.Int, userId)
      .query(`
        INSERT INTO bloco_lancamentos
          (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
           numero_referencia, status, observacao, sentido, criado_por, criado_em)
        OUTPUT INSERTED.*
        VALUES
          (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque,
           @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())
      `);

    const lanc = result.recordset[0];

    // NOVO: se for SAÍDA e tiver bom_para -> cria título em financeiro_titulos
    if (sentido === "SAIDA" && bomParaISO) {
      try {
        await pool
          .request()
          .input("cliente_id", sql.Int, clienteIdDoBloco)
          .input("tipo", sql.VarChar, tipoStr) // CHEQUE/BOLETO/PIX/DEPOSITO...
          .input("forma_id", sql.Int, null)
          .input("numero_doc", sql.VarChar, raw.numero_referencia ?? null)
          .input("banco", sql.VarChar, null)
          .input("agencia", sql.VarChar, null)
          .input("conta", sql.VarChar, null)
          .input("bom_para", sql.Date, new Date(bomParaISO))
          .input("valor_bruto", sql.Decimal(18, 2), valor)
          .input("valor_baixado", sql.Decimal(18, 2), 0)
          .input("status", sql.VarChar, "ABERTO")
          .input("observacao", sql.VarChar, raw.observacao ?? null)
          .input("bloco_id", sql.Int, +bloco_id)
          .input("created_by", sql.Int, userId ?? null)
          .query(`
            INSERT INTO dbo.financeiro_titulos
              (cliente_id, tipo, forma_id, numero_doc, banco, agencia, conta, bom_para, valor_bruto, valor_baixado, status, observacao, bloco_id, created_by)
            VALUES
              (@cliente_id, @tipo, @forma_id, @numero_doc, @banco, @agencia, @conta, @bom_para, @valor_bruto, @valor_baixado, @status, @observacao, @bloco_id, @created_by)
          `);
      } catch (e) {
        console.error("Falha ao criar título financeiro para lançamento com bom_para:", e);
      }
    }

    res.status(201).json(lanc);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao adicionar lançamento ao bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};


/** Saldo “legado” (SAÍDAS - ENTRADAS) — inclui tudo, inclusive pendentes (mantido) */
export const getBlocoSaldo = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rs = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(`
        SELECT
          @bloco_id AS bloco_id,
          COALESCE(SUM(CASE WHEN sentido = 'SAIDA'   THEN valor ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN sentido = 'ENTRADA' THEN valor ELSE 0 END), 0) AS saldo
        FROM bloco_lancamentos
        WHERE bloco_id = @bloco_id
      `);

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
 * NOVO: Saldo com separação
 * - saldo = SAÍDAS - ENTRADAS **ignorando** lançamentos com bom_para (pendentes)
 * - a_receber = soma de (valor_bruto - valor_baixado) de financeiro_titulos do bloco com status ABERTO/PARCIAL
 */
export const getBlocoSaldos = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // existência
    const exists = await pool.request()
      .input("bloco_id", sql.Int, +id)
      .query(`SELECT TOP 1 id, cliente_id FROM blocos WHERE id = @bloco_id`);
    if (!exists.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }

    // saldo “normal” (ignora tudo que tem bom_para, pois vai pro A Receber)
    const saldoRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(`
        SELECT
          COALESCE(SUM(CASE WHEN sentido='SAIDA'   AND bom_para IS NULL THEN valor ELSE 0 END),0)
        - COALESCE(SUM(CASE WHEN sentido='ENTRADA' AND bom_para IS NULL THEN valor ELSE 0 END),0) AS saldo
        FROM bloco_lancamentos
        WHERE bloco_id = @bloco_id
      `);
    const saldo = Number(saldoRS.recordset[0]?.saldo ?? 0);

    // a receber (somente títulos do bloco ABERTOS/PARCIAIS)
    const aRecRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(`
        SELECT COALESCE(SUM(valor_bruto - valor_baixado), 0) AS a_receber
        FROM dbo.financeiro_titulos
        WHERE bloco_id = @bloco_id
          AND status IN ('ABERTO','PARCIAL')
      `);
    const a_receber = Number(aRecRS.recordset[0]?.a_receber ?? 0);

    res.json({ bloco_id: Number(id), saldo, a_receber });
  } catch (error) {
    console.error("Erro em getBlocoSaldos:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};


/** Fechar bloco usando a NOVA regra (sem depender da view) */
export const fecharBloco = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // calcula saldo direto na base (aqui mantém regra antiga – inclui pendentes também)
    const saldoRS = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query(`
        SELECT b.id, b.cliente_id,
          (
            COALESCE((
              SELECT SUM(valor) FROM bloco_lancamentos
              WHERE bloco_id = b.id AND sentido = 'SAIDA'
            ), 0)
            -
            COALESCE((
              SELECT SUM(valor) FROM bloco_lancamentos
              WHERE bloco_id = b.id AND sentido = 'ENTRADA'
            ), 0)
          ) AS saldo
        FROM blocos b
        WHERE b.id = @bloco_id
      `);

    if (!saldoRS.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }

    const row = saldoRS.recordset[0] as {
      id: number;
      cliente_id: number;
      saldo: number | null;
    };
    const saldo = Number(row.saldo ?? 0);

    const result = await pool
      .request()
      .input("id", sql.Int, +id)
      .query(`
        UPDATE blocos
        SET status = 'FECHADO', fechado_em = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @id AND status = 'ABERTO'
      `);

    if (!result.recordset.length) {
      return res
        .status(404)
        .json({ message: "Bloco não encontrado ou já está fechado" });
    }

    if (saldo > 0) {
      try { await logCreditoGerado(row.cliente_id, row.id, saldo); }
      catch (e) { console.error("Falha ao registrar crédito do cliente em auditoria_logs:", e); }
    }

    if (saldo < 0) {
      try { await logDebitoGerado(row.cliente_id, row.id, Math.abs(saldo)); }
      catch (e) { console.error("Falha ao registrar débito do cliente em auditoria_logs:", e); }
    }

    res.json({ ...result.recordset[0], saldo_no_fechamento: saldo });
  } catch (error) {
    console.error("Erro ao fechar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const unlinkPedido = async (req: AuthenticatedRequest, res: Response) => {
  const bloco_id = Number(req.params.id);
  const pedido_id = Number(req.params.pedido_id);
  const userId = req.user?.id ?? null;

  if (!Number.isInteger(bloco_id) || !Number.isInteger(pedido_id)) {
    return res.status(400).json({ message: "IDs inválidos" });
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const b = await new sql.Request(tx)
      .input("bloco_id", sql.Int, bloco_id)
      .query("SELECT status FROM blocos WHERE id=@bloco_id");
    if (!b.recordset.length || b.recordset[0].status !== "ABERTO") {
      await tx.rollback();
      return res.status(400).json({ message: "Bloco não encontrado ou FECHADO" });
    }

    const v = await new sql.Request(tx)
      .input("bloco_id", sql.Int, bloco_id)
      .input("pedido_id", sql.Int, pedido_id)
      .query(
        "SELECT id FROM bloco_pedidos WHERE bloco_id=@bloco_id AND pedido_id=@pedido_id"
      );
    if (!v.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ message: "Vínculo não encontrado" });
    }

    const saidaQ = await new sql.Request(tx)
      .input("bloco_id", sql.Int, bloco_id)
      .input("pedido_ref", sql.VarChar(60), String(pedido_id))
      .query(`
        SELECT TOP 1 id, valor, status
        FROM bloco_lancamentos
        WHERE bloco_id=@bloco_id
          AND tipo_recebimento='PEDIDO'
          AND (numero_referencia=@pedido_ref OR numero_referencia='PED-'+@pedido_ref)
        ORDER BY id DESC
      `);

    if (saidaQ.recordset.length) {
      const saida = saidaQ.recordset[0];
      if (saida.status === "PENDENTE") {
        await new sql.Request(tx).input("id", sql.Int, saida.id).query(
          "DELETE FROM bloco_lancamentos WHERE id=@id"
        );
      } else {
        await new sql.Request(tx)
          .input("bloco_id", sql.Int, bloco_id)
          .input("valor", sql.Decimal(18, 2), saida.valor)
          .input("userId", sql.Int, userId)
          .input("ref", sql.VarChar(60), `ESTORNO-PED-${pedido_id}`)
          .input("pedidoId", sql.Int, pedido_id)
          .query(`
            INSERT INTO bloco_lancamentos
              (bloco_id, tipo_recebimento, valor, data_lancamento, status, observacao, sentido,
               numero_referencia, criado_por, criado_em, referencia_pedido_id)
            VALUES
              (@bloco_id, 'DEVOLUCAO', @valor, SYSUTCDATETIME(), 'PENDENTE',
               'Estorno automático do pedido', 'ENTRADA', @ref, @userId, SYSUTCDATETIME(), @pedidoId)
          `);
      }
    }

    await new sql.Request(tx)
      .input("bloco_id", sql.Int, bloco_id)
      .input("pedido_id", sql.Int, pedido_id)
      .query(
        "DELETE FROM bloco_pedidos WHERE bloco_id=@bloco_id AND pedido_id=@pedido_id"
      );

    await tx.commit();
    return res.json({ message: "Pedido desvinculado com sucesso" });
  } catch (e) {
    await tx.rollback();
    console.error("Erro no unlinkPedido:", e);
    return res.status(500).json({ message: "Erro interno" });
  }
};

/* =========================================================
   Listagens
   ========================================================= */

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

    const totalRs = await totalReq.query(`
      SELECT COUNT(*) AS total
      FROM blocos b
      LEFT JOIN clientes c ON c.id = b.cliente_id
      ${whereSql}
    `);
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    const pageReq = pool.request().input("limit", limit).input("offset", offset);
    if (status) pageReq.input("status", status);
    if (cliente_id) pageReq.input("cliente_id", cliente_id);
    if (cliente) pageReq.input("cliente", cliente);
    if (search) pageReq.input("search", search);

    const rs = await pageReq.query(`
      SELECT
        b.id, b.codigo, b.status, b.cliente_id, c.nome_fantasia AS cliente_nome,
        b.aberto_em, b.fechado_em, b.observacao
      FROM blocos b
      LEFT JOIN clientes c ON c.id = b.cliente_id
      ${whereSql}
      ORDER BY b.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `);

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
      .query(`
        SELECT
          b.id, b.codigo, b.status, b.cliente_id, c.nome_fantasia AS cliente_nome,
          b.aberto_em, b.fechado_em, b.observacao
        FROM blocos b
        LEFT JOIN clientes c ON c.id = b.cliente_id
        WHERE b.id = @id
      `);

    if (!rs.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }
    return res.json(rs.recordset[0]);
  } catch (err) {
    console.error("Erro em getBlocoById:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const listPedidosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const listPedidosDoBloco = async (req: Request, res: Response) => {
  try {
    const bloco_id = +req.params.id;
    const { page, limit } = listPedidosQuerySchema.parse(req.query);
    const offset = (page - 1) * limit;

    const baseReq = pool.request().input("bloco_id", bloco_id);

    const totalRs = await baseReq.query(`
      SELECT COUNT(*) AS total
      FROM bloco_pedidos bp
      WHERE bp.bloco_id = @bloco_id
    `);
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    const pageReq = pool
      .request()
      .input("bloco_id", bloco_id)
      .input("limit", limit)
      .input("offset", offset);
    const rs = await pageReq.query(`
      SELECT
        bp.id,
        bp.bloco_id,
        bp.pedido_id,
        p.cliente_id,
        p.valor_total,
        p.data_pedido,
        p.numero_pedido_ext,
        p.observacao AS descricao,
        bp.criado_em,
        bp.criado_por
      FROM bloco_pedidos bp
      LEFT JOIN pedidos p ON p.id = bp.pedido_id
      WHERE bp.bloco_id = @bloco_id
      ORDER BY bp.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return res.json({ data: rs.recordset, page, limit, total });
  } catch (err) {
    console.error("Erro em listPedidosDoBloco:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const listLancQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  status: z
    .enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"])
    .optional(),
  tipo: z.string().optional(), // agora texto livre (filtra igual)
});

export const listLancamentosDoBloco = async (req: Request, res: Response) => {
  try {
    const bloco_id = +req.params.id;
    const { page, limit, status, tipo } = listLancQuerySchema.parse(req.query);
    const offset = (page - 1) * limit;

    const where: string[] = ["bloco_id = @bloco_id"];
    const reqDb = pool.request().input("bloco_id", bloco_id);
    if (status) {
      where.push("status = @status");
      reqDb.input("status", status);
    }
    if (tipo) {
      where.push("tipo_recebimento = @tipo");
      reqDb.input("tipo", tipo.toUpperCase());
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const totalRs = await reqDb.query(`
      SELECT COUNT(*) AS total
      FROM bloco_lancamentos
      ${whereSql}
    `);
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    const pageReq = pool
      .request()
      .input("bloco_id", bloco_id)
      .input("limit", limit)
      .input("offset", offset);
    if (status) pageReq.input("status", status);
    if (tipo) pageReq.input("tipo", tipo.toUpperCase());

    const rs = await pageReq.query(`
      SELECT
        id, bloco_id, tipo_recebimento, sentido, valor,
        data_lancamento, bom_para, tipo_cheque, numero_referencia,
        status, observacao, criado_por, criado_em,
        referencia_pedido_id, referencia_lancamento_id
      FROM bloco_lancamentos
      ${whereSql}
      ORDER BY id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return res.json({ data: rs.recordset, page, limit, total });
  } catch (err) {
    console.error("Erro em listLancamentosDoBloco:", err);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};
