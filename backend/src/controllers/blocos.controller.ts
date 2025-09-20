// src/controllers/blocos.controller.ts
import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import sql from "mssql";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

/* ========================= Schemas ========================= */

const createBlocoSchema = z.object({
  cliente_id: z.number().int("ID do cliente deve ser um inteiro"),
  codigo: z.string().optional(),
  observacao: z.string().optional(),
});

// aceita opcionalmente o valor do pedido para gerar a SAÍDA automática
const addPedidoSchema = z.object({
  pedido_id: z.number().int("ID do pedido deve ser um inteiro"),
  valor_pedido: z.number().positive().optional(),
});

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

const addLancamentoSchema = z
  .object({
    tipo_recebimento: z.enum(allowedRecebimentos),
    valor: z.number(),
    data_lancamento: z.string().datetime(),
    bom_para: z.string().datetime().optional(),
    tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
    numero_referencia: z.string().optional(),
    status: z
      .enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"])
      .default("PENDENTE"),
    observacao: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo_recebimento === "CHEQUE") {
      if (!data.tipo_cheque) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "tipo_cheque é obrigatório para CHEQUE",
          path: ["tipo_cheque"],
        });
      }
      if (!data.bom_para) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bom_para é obrigatório para CHEQUE",
          path: ["bom_para"],
        });
      }
    }
  });

/* ========================= Helpers ========================= */

const gerarCodigo = (clienteId: number) =>
  `B${clienteId}-${Date.now().toString(36).toUpperCase()}`;

const mapRecebimentoToSentido = (tipo: (typeof allowedRecebimentos)[number]) => {
  const entradas = new Set(["CHEQUE", "DINHEIRO", "BOLETO", "DEPOSITO", "PIX"]);
  return entradas.has(tipo) ? "ENTRADA" : "SAIDA";
};

/* ========================= Controllers ========================= */

export const createBloco = async (req: Request, res: Response) => {
  try {
    const { cliente_id, codigo, observacao } = createBlocoSchema.parse(req.body);
    const finalCodigo = codigo ?? gerarCodigo(cliente_id);

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

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if ((error as any).number === 2627) {
      return res
        .status(409)
        .json({ message: "Já existe um bloco ABERTO com este código para o cliente" });
    }
    console.error("Erro ao criar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const addPedidoToBloco = async (req: AuthenticatedRequest, res: Response) => {
  const { id: bloco_id } = req.params;

  try {
    const { pedido_id, valor_pedido } = addPedidoSchema.parse(req.body);
    const userId = req.user?.id ?? null;

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // 1) Bloco
      const bloco = await new sql.Request(tx)
        .input("bloco_id", sql.Int, +bloco_id)
        .query("SELECT id, status, cliente_id FROM blocos WHERE id = @bloco_id");

      if (!bloco.recordset.length) {
        await tx.rollback();
        return res.status(404).json({ message: "Bloco não encontrado" });
      }
      if (bloco.recordset[0].status !== "ABERTO") {
        await tx.rollback();
        return res
          .status(400)
          .json({ message: "Não é possível adicionar pedido em bloco FECHADO" });
      }

      // 2) Pedido já vinculado?
      const jaVinculado = await new sql.Request(tx)
        .input("pedido_id", sql.Int, pedido_id)
        .query("SELECT 1 FROM bloco_pedidos WHERE pedido_id = @pedido_id");

      if (jaVinculado.recordset.length) {
        await tx.rollback();
        return res.status(409).json({ message: "Pedido já está vinculado a outro bloco" });
      }

      // 3) Vincula
      const insertedVinculo = await new sql.Request(tx)
        .input("bloco_id", sql.Int, +bloco_id)
        .input("pedido_id", sql.Int, pedido_id)
        .query(`
          INSERT INTO bloco_pedidos (bloco_id, pedido_id)
          OUTPUT INSERTED.*
          VALUES (@bloco_id, @pedido_id)
        `);

      // 4) Lançamento SAÍDA automático
      let lancamentoGerado = false;
      if (valor_pedido && valor_pedido > 0) {
        await new sql.Request(tx)
          .input("bloco_id", sql.Int, +bloco_id)
          .input("tipo_recebimento", sql.VarChar(30), "PEDIDO")
          .input("valor", sql.Decimal(18, 2), valor_pedido)
          .input("data_lancamento", sql.DateTime2, new Date().toISOString())
          .input("bom_para", sql.DateTime2, null)
          .input("tipo_cheque", sql.VarChar(15), null)
          .input("numero_referencia", sql.VarChar(100), String(pedido_id))
          .input("status", sql.VarChar(15), "PENDENTE")
          .input("observacao", sql.VarChar(sql.MAX), "Débito automático do pedido")
          .input("sentido", sql.VarChar(10), "SAIDA")
          .input("criado_por", sql.Int, userId)
          .query(`
            INSERT INTO bloco_lancamentos
              (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque,
               numero_referencia, status, observacao, sentido, criado_por, criado_em)
            VALUES
              (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque,
               @numero_referencia, @status, @observacao, @sentido, @criado_por, SYSUTCDATETIME())
          `);
        lancamentoGerado = true;
      }

      await tx.commit();
      return res.status(201).json({
        message: "Pedido vinculado ao bloco com sucesso",
        data: insertedVinculo.recordset[0],
        lancamento_gerado: lancamentoGerado,
      });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao adicionar pedido ao bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const addLancamentoToBloco = async (req: AuthenticatedRequest, res: Response) => {
  const { id: bloco_id } = req.params;

  try {
    const data = addLancamentoSchema.parse(req.body);
    const userId = req.user?.id ?? null;
    const sentido = mapRecebimentoToSentido(data.tipo_recebimento);

    const result = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .input("tipo_recebimento", sql.VarChar(30), data.tipo_recebimento)
      .input("valor", sql.Decimal(18, 2), data.valor)
      .input("data_lancamento", sql.DateTime2, data.data_lancamento)
      .input("bom_para", sql.DateTime2, data.bom_para ?? null)
      .input("tipo_cheque", sql.VarChar(15), data.tipo_cheque ?? null)
      .input("numero_referencia", sql.VarChar(100), data.numero_referencia ?? null)
      .input("status", sql.VarChar(15), data.status)
      .input("observacao", sql.VarChar(sql.MAX), data.observacao ?? null)
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

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao adicionar lançamento ao bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getBlocoSaldo = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query("SELECT * FROM vw_blocos_saldo WHERE bloco_id = @bloco_id");

    if (!result.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar saldo do bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const fecharBloco = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const saldoResult = await pool
      .request()
      .input("bloco_id", sql.Int, +id)
      .query("SELECT saldo FROM vw_blocos_saldo WHERE bloco_id = @bloco_id");

    if (!saldoResult.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }

    const saldo: number = saldoResult.recordset[0].saldo ?? 0;
    if (Number(saldo) !== 0) {
      return res
        .status(400)
        .json({ message: `Não é possível fechar o bloco. Saldo atual: ${saldo}` });
    }

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

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao fechar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/* ========= FIX: Request novo a cada query para evitar EDUPEPARAM ========= */
export const unlinkPedido = async (req: AuthenticatedRequest, res: Response) => {
  const bloco_id = Number(req.params.id);
  const pedido_id = Number(req.params.pedido_id); // <-- nome alinhado com a rota/Front
  const userId = req.user?.id ?? null;

  if (!Number.isInteger(bloco_id) || !Number.isInteger(pedido_id)) {
    return res.status(400).json({ message: "IDs inválidos" });
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // 1) bloco ABERTO?
    const b = await new sql.Request(tx)
      .input("bloco_id", sql.Int, bloco_id)
      .query("SELECT status FROM blocos WHERE id=@bloco_id");
    if (!b.recordset.length || b.recordset[0].status !== "ABERTO") {
      await tx.rollback();
      return res.status(400).json({ message: "Bloco não encontrado ou FECHADO" });
    }

    // 2) vínculo existe?
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

    // 3) localizar saída automática "PEDIDO"
    const saidaQ = await new sql.Request(tx)
      .input("bloco_id", sql.Int, bloco_id)
      .input("pedido_ref", sql.VarChar(100), String(pedido_id))
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
        // apaga a saída pendente
        await new sql.Request(tx).input("id", sql.Int, saida.id).query(
          "DELETE FROM bloco_lancamentos WHERE id=@id"
        );
      } else {
        // estorno (ENTRADA)
        await new sql.Request(tx)
          .input("bloco_id", sql.Int, bloco_id)
          .input("valor", sql.Decimal(18, 2), saida.valor)
          .input("userId", sql.Int, userId)
          .input("ref", sql.VarChar(100), `ESTORNO-PED-${pedido_id}`)
          .query(`
            INSERT INTO bloco_lancamentos
              (bloco_id, tipo_recebimento, valor, data_lancamento, status, observacao, sentido,
               numero_referencia, criado_por, criado_em, referencia_pedido_id)
            VALUES
              (@bloco_id, 'DEVOLUCAO', @valor, SYSUTCDATETIME(), 'PENDENTE',
               'Estorno automático do pedido', 'ENTRADA', @ref, @userId, SYSUTCDATETIME(), ${pedido_id})
          `);
      }
    }

    // 4) remove vínculo
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

// ========================= Listagens (para o Front) =========================

const listBlocosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  status: z.enum(["ABERTO", "FECHADO"]).optional(),
  cliente_id: z.coerce.number().int().optional(),
  cliente: z.string().trim().optional(), // novo filtro por nome_fantasia
  search: z.string().trim().optional(),  // ex.: por código
});

export const listBlocos = async (req: Request, res: Response) => {
  try {
    const { page, limit, status, cliente_id, cliente, search } =
      listBlocosQuerySchema.parse(req.query);
    const offset = (page - 1) * limit;

    // monta WHERE dinâmico
    const where: string[] = [];
    if (status) where.push("b.status = @status");
    if (cliente_id) where.push("b.cliente_id = @cliente_id");
    if (cliente) where.push("c.nome_fantasia LIKE '%' + @cliente + '%'");
    if (search) where.push("(b.codigo LIKE '%' + @search + '%')");

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // total
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

    // página
    const pageReq = pool
      .request()
      .input("limit", limit)
      .input("offset", offset);
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
    // front espera o objeto direto
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

    // total
    const totalRs = await baseReq.query(`
      SELECT COUNT(*) AS total
      FROM bloco_pedidos bp
      WHERE bp.bloco_id = @bloco_id
    `);
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    // pagina
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
  status: z.enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"]).optional(),
  tipo: z
    .enum([
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
    ])
    .optional(),
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
      reqDb.input("tipo", tipo);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    // total
    const totalRs = await reqDb.query(`
      SELECT COUNT(*) AS total
      FROM bloco_lancamentos
      ${whereSql}
    `);
    const total = Number(totalRs.recordset[0]?.total ?? 0);

    // pagina
    const pageReq = pool
      .request()
      .input("bloco_id", bloco_id)
      .input("limit", limit)
      .input("offset", offset);
    if (status) pageReq.input("status", status);
    if (tipo) pageReq.input("tipo", tipo);

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
