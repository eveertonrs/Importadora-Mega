import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import sql from "mssql";

/** mapeia sentido pelo tipo (mantém similar aos blocos) */
const entradas = new Set(["CHEQUE", "DINHEIRO", "BOLETO", "DEPOSITO", "PIX"]);
const mapRecebimentoToSentido = (t: string) => (entradas.has(t.toUpperCase()) ? "ENTRADA" : "SAIDA");

/** payload que o front envia ao criar */
const createSchema = z.object({
  cliente_id: z.number().int(),
  valor: z.number().positive(),
  forma_pagamento: z.string().min(1),
  observacao: z.string().optional().nullable(),
  /** opcionais “escondidos” (não usados no seu front, mas ok manter) */
  bloco_id: z.number().int().optional(),
  data_lancamento: z.string().datetime().optional(),
  data_vencimento: z.string().datetime().optional(),
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().optional(),
});

/** lista genérica (não usada no seu front, mas mantida) */
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

    if (cliente_id) { query += " AND b.cliente_id = @cliente_id"; reqDb.input("cliente_id", Number(cliente_id)); }
    if (status)      { query += " AND bl.status = @status";        reqDb.input("status", status); }
    if (tipo_recebimento) { query += " AND bl.tipo_recebimento = @tipo"; reqDb.input("tipo", tipo_recebimento); }

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
      .input("id", Number(id))
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

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      let blocoId = data.bloco_id;

      // encontra (ou cria) bloco ABERTO do cliente
      if (!blocoId) {
        const q = await new sql.Request(tx)
          .input("cliente_id", sql.Int, data.cliente_id)
          .query(`
            SELECT TOP 1 id FROM blocos
            WHERE cliente_id=@cliente_id AND status='ABERTO'
            ORDER BY aberto_em DESC
          `);
        if (q.recordset.length) {
          blocoId = q.recordset[0].id;
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
          blocoId = novo.recordset[0].id;
        }
      } else {
        // valida bloco informado
        const ok = await new sql.Request(tx)
          .input("bloco_id", sql.Int, blocoId)
          .input("cliente_id", sql.Int, data.cliente_id)
          .query(`
            SELECT 1 FROM blocos
            WHERE id=@bloco_id AND cliente_id=@cliente_id AND status='ABERTO'
          `);
        if (!ok.recordset.length) {
          await tx.rollback();
          return res.status(400).json({ message: "Bloco inválido (inexistente/fechado ou de outro cliente)." });
        }
      }

      const tipo = data.forma_pagamento.toUpperCase();
      const sentido = mapRecebimentoToSentido(tipo);

      const inserted = await new sql.Request(tx)
        .input("bloco_id", sql.Int, blocoId)
        .input("tipo_recebimento", sql.VarChar(30), tipo)
        .input("valor", sql.Decimal(18,2), data.valor)
        .input("data_lancamento", sql.DateTime2, data.data_lancamento ?? new Date().toISOString())
        .input("bom_para", sql.DateTime2, data.data_vencimento ?? null)
        .input("tipo_cheque", sql.VarChar(15), data.tipo_cheque ?? null)
        .input("numero_referencia", sql.VarChar(100), data.numero_referencia ?? null)
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
  const updateSchema = createSchema.omit({ cliente_id: true, bloco_id: true }).partial();

  try {
    const data = updateSchema.parse(req.body);

    const pairs: string[] = [];
    const reqDb = pool.request().input("id", Number(id));

    // mapeia campos do payload -> colunas
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (k === "forma_pagamento") { pairs.push("tipo_recebimento=@forma_pagamento"); reqDb.input("forma_pagamento", String(v)); continue; }
      if (k === "data_vencimento") { pairs.push("bom_para=@data_vencimento"); reqDb.input("data_vencimento", v as any); continue; }
      if (k === "observacao")      { pairs.push("observacao=@observacao"); reqDb.input("observacao", v as any); continue; }
      pairs.push(`${k}=@${k}`); reqDb.input(k, v as any);
    }

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
    const rs = await pool.request().input("id", Number(id))
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
      .input("cliente_id", Number(cliente_id))
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
  // aceita: GET /pagamentos/historico?cliente_id=123 (se não vier, lista todos)
  const { cliente_id } = req.query as { cliente_id?: string };
  try {
    const reqDb = pool.request();
    let where = "1=1";
    if (cliente_id && cliente_id !== "") {
      where += " AND b.cliente_id=@cliente_id";
      reqDb.input("cliente_id", Number(cliente_id));
    }

    const rs = await reqDb.query(`
      SELECT
        bl.id,
        b.cliente_id,
        bl.valor,
        bl.tipo_recebimento AS forma_pagamento,
        bl.criado_em,
        bl.observacao
      FROM bloco_lancamentos bl
      JOIN blocos b ON b.id = bl.bloco_id
      WHERE ${where}
      ORDER BY bl.criado_em DESC, bl.id DESC
    `);

    res.json(rs.recordset);
  } catch (e) {
    console.error("Erro ao buscar histórico:", e);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
