import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import sql from "mssql";

/** mapeia sentido pelo tipo (alinhado aos blocos) */
const entradas = new Set(["CHEQUE", "DINHEIRO", "BOLETO", "DEPOSITO", "PIX", "BONIFICACAO", "DEVOLUCAO"]);
const mapRecebimentoToSentido = (t: string) => (entradas.has(t.toUpperCase()) ? "ENTRADA" : "SAIDA");

const allowedRecebimentos = [
  "CHEQUE",
  "DINHEIRO",
  "BOLETO",
  "DEPOSITO",
  "PIX",
  "TROCA",
  "BONIFICACAO",
  "DESCONTO A VISTA",
  "DEVOLUCAO",
  "PEDIDO",
] as const;

const dateTimeISO = z.string().datetime().optional();

/** payload que o front envia ao criar */
const createSchema = z.object({
  cliente_id: z.number().int(),
  valor: z.number().positive(),
  forma_pagamento: z.enum(allowedRecebimentos),
  observacao: z.string().optional().nullable(),
  /** opcionais “escondidos” (não usados no seu front, mas ok manter) */
  bloco_id: z.number().int().optional(),
  data_lancamento: dateTimeISO,
  data_vencimento: dateTimeISO,                // mapeia para bom_para
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().max(60).optional(), // <= varchar(60)
});

/* ======= helpers de crédito via auditoria_logs (sem mudar schema) ======= */

async function findPendingCreditoTx(tx: sql.Transaction, clienteId: number): Promise<{ log_id: number; valor: number } | null> {
  const rs = await new sql.Request(tx)
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

async function logCreditoConsumidoTx(tx: sql.Transaction, clienteId: number, origLogId: number, blocoId: number, valor: number) {
  await new sql.Request(tx)
    .input("usuario_id", sql.Int, null)
    .input("entidade", sql.VarChar(50), "credito_cliente")
    .input("entidade_id", sql.VarChar(50), String(clienteId))
    .input("acao", sql.VarChar(20), "CONSUMIDO")
    .input("payload_json", sql.NVarChar(sql.MAX), JSON.stringify({
      orig_log_id: String(origLogId),
      bloco_id: blocoId,
      valor,
      consumido_em_utc: new Date().toISOString()
    }))
    .query(`
      INSERT INTO auditoria_logs (usuario_id, entidade, entidade_id, acao, payload_json, criado_em)
      VALUES (@usuario_id, @entidade, @entidade_id, @acao, @payload_json, SYSUTCDATETIME());
    `);
}

/** lista genérica (opcional) */
export const getPagamentos = async (req: Request, res: Response) => {
  try {
    const { cliente_id, status, tipo_recebimento } = req.query as {
      cliente_id?: string;
      status?: "PENDENTE" | "LIQUIDADO" | "DEVOLVIDO" | "CANCELADO";
      tipo_recebimento?: string;
    };

    let query = `
      SELECT bl.*, b.cliente_id, c.nome_fantasia, b.status AS status_bloco
      FROM bloco_lancamentos bl
      JOIN blocos b ON bl.bloco_id = b.id
      JOIN clientes c ON b.cliente_id = c.id
      WHERE 1=1
    `;
    const reqDb = pool.request();

    if (cliente_id) { query += " AND b.cliente_id = @cliente_id"; reqDb.input("cliente_id", sql.Int, Number(cliente_id)); }
    if (status)      { query += " AND bl.status = @status";        reqDb.input("status", sql.VarChar(15), status); }
    if (tipo_recebimento) { query += " AND bl.tipo_recebimento = @tipo"; reqDb.input("tipo", sql.VarChar(30), tipo_recebimento); }

    query += " ORDER BY bl.data_lancamento DESC, bl.id DESC";
    const rs = await reqDb.query(query);
    res.json(rs.recordset);
  } catch (e) {
    console.error("Erro ao buscar pagamentos:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** obter 1 lançamento */
export const getPagamentoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rs = await pool.request()
      .input("id", sql.Int, Number(id))
      .query(`
        SELECT bl.*, b.cliente_id, c.nome_fantasia
          FROM bloco_lancamentos bl
          JOIN blocos b ON bl.bloco_id = b.id
          JOIN clientes c ON b.cliente_id = c.id
         WHERE bl.id = @id
      `);
    if (!rs.recordset.length) return res.status(404).json({ message: "Lançamento não encontrado" });
    res.json(rs.recordset[0]);
  } catch (e) {
    console.error("Erro ao buscar lançamento:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** criar lançamento – compatível com PagamentoForm do front */
export const createPagamento = async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);

    if (data.forma_pagamento === "CHEQUE") {
      if (!data.tipo_cheque) {
        return res.status(400).json({ message: "tipo_cheque é obrigatório para CHEQUE." });
      }
      if (!data.data_vencimento) {
        return res.status(400).json({ message: "data_vencimento (bom_para) é obrigatória para CHEQUE." });
      }
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // estreita tipo explicitamente
      let blocoId: number;

      const providedBlocoId = data.bloco_id; // number | undefined
      if (typeof providedBlocoId !== "number") {
        // não veio bloco -> busca ou cria
        const q = await new sql.Request(tx)
          .input("cliente_id", sql.Int, data.cliente_id)
          .query(`
            SELECT TOP 1 id FROM blocos
            WHERE cliente_id=@cliente_id AND status='ABERTO'
            ORDER BY aberto_em DESC
          `);

        if (q.recordset.length) {
          blocoId = q.recordset[0].id as number;
        } else {
          const codigo = `AUTO-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0,12)}`;
          const novo = await new sql.Request(tx)
            .input("cliente_id", sql.Int, data.cliente_id)
            .input("codigo", sql.VarChar(50), codigo)
            .input("obs", sql.VarChar(sql.MAX), "Criado automaticamente ao inserir lançamento")
            .query(`
              INSERT INTO blocos (cliente_id, codigo, status, aberto_em, observacao)
              OUTPUT INSERTED.id
              VALUES (@cliente_id, @codigo, 'ABERTO', SYSUTCDATETIME(), @obs)
            `);
          blocoId = novo.recordset[0].id as number;

          // crédito pendente?
          const pend = await findPendingCreditoTx(tx, data.cliente_id);
          if (pend) {
            await new sql.Request(tx)
              .input("bloco_id", sql.Int, blocoId) // <- agora é number
              .input("tipo_recebimento", sql.VarChar(30), "BONIFICACAO")
              .input("valor", sql.Decimal(18, 2), pend.valor)
              .input("data_lancamento", sql.DateTime2, new Date().toISOString())
              .input("bom_para", sql.DateTime2, null)
              .input("tipo_cheque", sql.VarChar(15), null)
              .input("numero_referencia", sql.VarChar(60), `CRED-ANT-${pend.log_id}`)
              .input("status", sql.VarChar(15), "PENDENTE")
              .input("observacao", sql.VarChar(sql.MAX), "Crédito bloco anterior (consumido)")
              .input("sentido", sql.VarChar(10), "ENTRADA")
              .query(`
                INSERT INTO bloco_lancamentos
                  (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
                   numero_referencia, status, observacao, sentido, criado_em)
                VALUES
                  (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque,
                   @numero_referencia, @status, @observacao, @sentido, SYSUTCDATETIME())
              `);

            await logCreditoConsumidoTx(tx, data.cliente_id, pend.log_id, blocoId, pend.valor);
          }
        }
      } else {
        // veio bloco -> valida e fixa como number
        const ok = await new sql.Request(tx)
          .input("bloco_id", sql.Int, providedBlocoId)
          .input("cliente_id", sql.Int, data.cliente_id)
          .query(`
            SELECT 1 FROM blocos
            WHERE id=@bloco_id AND cliente_id=@cliente_id AND status='ABERTO'
          `);
        if (!ok.recordset.length) {
          await tx.rollback();
          return res.status(400).json({ message: "Bloco inválido (inexistente/fechado ou de outro cliente)." });
        }
        blocoId = providedBlocoId; // agora 100% number
      }

      const tipo = data.forma_pagamento.toUpperCase();
      const sentido = mapRecebimentoToSentido(tipo);
      const isCheque = tipo === "CHEQUE";
      const tipoCheque = isCheque ? data.tipo_cheque ?? null : null;
      const bomPara = data.data_vencimento ?? null;

      const inserted = await new sql.Request(tx)
        .input("bloco_id", sql.Int, blocoId) // <- number garantido
        .input("tipo_recebimento", sql.VarChar(30), tipo)
        .input("valor", sql.Decimal(18,2), data.valor)
        .input("data_lancamento", sql.DateTime2, data.data_lancamento ?? new Date().toISOString())
        .input("bom_para", sql.DateTime2, bomPara)
        .input("tipo_cheque", sql.VarChar(15), tipoCheque)
        .input("numero_referencia", sql.VarChar(60), data.numero_referencia ?? null)
        .input("status", sql.VarChar(15), "PENDENTE")
        .input("observacao", sql.VarChar(sql.MAX), data.observacao ?? null)
        .input("sentido", sql.VarChar(10), sentido)
        .query(`
          INSERT INTO bloco_lancamentos
            (bloco_id, tipo_recebimento, sentido, valor, data_lancamento, bom_para, tipo_cheque,
             numero_referencia, status, observacao, criado_em)
          OUTPUT INSERTED.*
          VALUES
            (@bloco_id, @tipo_recebimento, @sentido, @valor, @data_lancamento, @bom_para,
             @tipo_cheque, @numero_referencia, @status, @observacao, SYSUTCDATETIME())
        `);

      await tx.commit();
      return res.status(201).json(inserted.recordset[0]);
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: e.errors });
    }
    console.error("Erro ao criar lançamento:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** atualizar – não é usado no seu front, mas mantive compatível */
export const updatePagamento = async (req: Request, res: Response) => {
  const { id } = req.params;

  // pode atualizar forma_pagamento; se mudar, atualizamos sentido também
  const updateSchema = z.object({
    valor: z.number().positive().optional(),
    forma_pagamento: z.enum(allowedRecebimentos).optional(),
    observacao: z.string().optional().nullable(),
    data_lancamento: z.string().datetime().optional(),
    data_vencimento: z.string().datetime().optional(),
    tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
    numero_referencia: z.string().max(60).optional(),
    status: z.enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"]).optional(),
  });

  try {
    const data = updateSchema.parse(req.body);

    const pairs: string[] = [];
    const reqDb = pool.request().input("id", sql.Int, Number(id));

    if (data.forma_pagamento) {
      const tipo = data.forma_pagamento.toUpperCase();
      const sentido = mapRecebimentoToSentido(tipo);
      pairs.push("tipo_recebimento=@forma_pagamento", "sentido=@sentido");
      reqDb.input("forma_pagamento", sql.VarChar(30), tipo);
      reqDb.input("sentido", sql.VarChar(10), sentido);

      // se não for cheque, limpamos tipo_cheque (consistência)
      if (tipo !== "CHEQUE") {
        pairs.push("tipo_cheque=NULL");
      }
    }

    if (data.valor !== undefined) { pairs.push("valor=@valor"); reqDb.input("valor", sql.Decimal(18,2), data.valor); }
    if (data.observacao !== undefined) { pairs.push("observacao=@observacao"); reqDb.input("observacao", sql.VarChar(sql.MAX), data.observacao); }
    if (data.data_lancamento !== undefined) { pairs.push("data_lancamento=@data_lancamento"); reqDb.input("data_lancamento", sql.DateTime2, data.data_lancamento); }
    if (data.data_vencimento !== undefined) { pairs.push("bom_para=@data_vencimento"); reqDb.input("data_vencimento", sql.DateTime2, data.data_vencimento); }
    if (data.tipo_cheque !== undefined) { pairs.push("tipo_cheque=@tipo_cheque"); reqDb.input("tipo_cheque", sql.VarChar(15), data.tipo_cheque); }
    if (data.numero_referencia !== undefined) { pairs.push("numero_referencia=@numero_referencia"); reqDb.input("numero_referencia", sql.VarChar(60), data.numero_referencia ?? null); }
    if (data.status !== undefined) { pairs.push("status=@status"); reqDb.input("status", sql.VarChar(15), data.status); }

    if (!pairs.length) return res.status(400).json({ message: "Nenhum campo para atualizar" });

    const rs = await reqDb.query(`
      UPDATE bloco_lancamentos
         SET ${pairs.join(", ")}
       OUTPUT INSERTED.*
       WHERE id=@id
    `);
    if (!rs.recordset.length) return res.status(404).json({ message: "Lançamento não encontrado" });
    res.json(rs.recordset[0]);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: e.errors });
    }
    console.error("Erro ao atualizar lançamento:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deletePagamento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const rs = await pool.request().input("id", sql.Int, Number(id))
      .query("DELETE FROM bloco_lancamentos WHERE id=@id");
    if ((rs.rowsAffected?.[0] ?? 0) === 0) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }
    res.status(204).send();
  } catch (e: any) {
    if (e?.number === 547) {
      return res.status(409).json({ message: "Não é possível excluir: lançamento vinculado a fechamento." });
    }
    console.error("Erro ao deletar lançamento:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** saldo consolidado em blocos ABERTOS (mantido) */
export const getSaldo = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;
  try {
    const rs = await pool.request()
      .input("cliente_id", sql.Int, Number(cliente_id))
      .query(`
        SELECT COALESCE(SUM(v.saldo),0) AS saldo
        FROM vw_blocos_saldo v
        JOIN blocos b ON b.id = v.bloco_id
        WHERE b.cliente_id=@cliente_id AND b.status='ABERTO'
      `);
    res.json({ saldo: rs.recordset[0].saldo });
  } catch (e) {
    console.error("Erro ao buscar saldo:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/** histórico – compatível com HistoricoPagamentos do front */
export const getHistorico = async (req: Request, res: Response) => {
  // GET /pagamentos/historico?cliente_id=123
  const { cliente_id } = req.query as { cliente_id?: string };

  try {
    const reqDb = pool.request();

    let where = "1=1";
    if (cliente_id && cliente_id !== "") {
      // 👇 o filtro é no cliente do BLOCO (alias 'bo'), não do lançamento
      where += " AND bo.cliente_id = @cliente_id";
      reqDb.input("cliente_id", sql.Int, Number(cliente_id));
    }

    const rs = await reqDb.query(`
      SELECT
        bl.id,
        bo.cliente_id,
        bl.valor,
        bl.tipo_recebimento        AS forma_pagamento,
        bl.criado_em,
        bl.observacao,
        bl.criado_por,             -- 👈 devolve o id do usuário
        u.nome                     AS criado_por_nome  -- 👈 devolve o nome do usuário
      FROM dbo.bloco_lancamentos bl
      JOIN dbo.blocos            bo ON bo.id = bl.bloco_id
      LEFT JOIN dbo.usuarios     u  ON u.id = bl.criado_por
      WHERE ${where}
      ORDER BY bl.criado_em DESC, bl.id DESC
    `);

    // seu front aceita array direto ou {data: array}; mantenha simples:
    res.json({ data: rs.recordset });
  } catch (e) {
    console.error("Erro ao buscar histórico:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
