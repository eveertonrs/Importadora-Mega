import { Request, Response } from "express";
import { z } from "zod";
import sql from "mssql";
import { pool, dbConfig } from "../db";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

/* ========================= Helpers ========================= */

const gerarCodigo = (clienteId: number) =>
  `B${clienteId}-${Date.now().toString(36).toUpperCase()}`;

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

const mapRecebimentoToSentido = (tipo: (typeof allowedRecebimentos)[number]) => {
  const entradas = new Set(["CHEQUE", "DINHEIRO", "BOLETO", "DEPOSITO", "PIX"]);
  return entradas.has(tipo) ? "ENTRADA" : "SAIDA";
};

// aceita ISO, YYYY-MM-DD e DD/MM/YYYY
function toISO(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // DD/MM/YYYY
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const [_, yyyy, mm, dd] = m2;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // tenta como ISO / Date parseável
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const n = Number(val.replace(".", "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/* ========================= Schemas (entrada crua) ========================= */

const createBlocoSchema = z.object({
  cliente_id: z.number().int("ID do cliente deve ser um inteiro"),
  codigo: z.string().optional(),
  observacao: z.string().optional(),
});

// aceita opcionalmente o valor do pedido para gerar a SAÍDA automática
const addPedidoSchema = z.object({
  pedido_id: z.number().int("ID do pedido deve ser um inteiro"),
  valor_pedido: z.coerce.number().positive().optional(),
});

// para lançamento, deixamos datas como string e normalizamos com helper
const addLancamentoSchema = z.object({
  tipo_recebimento: z.enum(allowedRecebimentos),
  valor: z.union([z.number(), z.string()]),
  data_lancamento: z.string().min(1, "data_lancamento é obrigatório"),
  bom_para: z.string().optional(),
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().optional(),
  status: z
    .enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"])
    .default("PENDENTE"),
  observacao: z.string().optional(),
});

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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    if (error?.number === 2627) {
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

    // 1) Bloco existe e está ABERTO?
    const b = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .query("SELECT id, status, cliente_id FROM blocos WHERE id = @bloco_id");

    if (!b.recordset.length) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }
    if (b.recordset[0].status !== "ABERTO") {
      return res.status(400).json({ message: "Não é possível adicionar pedido em bloco FECHADO" });
    }

    // 2) Já vinculado em algum bloco?
    const v = await pool
      .request()
      .input("pedido_id", sql.Int, pedido_id)
      .query("SELECT 1 FROM bloco_pedidos WHERE pedido_id = @pedido_id");

    if (v.recordset.length) {
      return res.status(409).json({ message: "Pedido já está vinculado a outro bloco" });
    }

    // 3) Pedido existe?
    const ped = await pool
      .request()
      .input("pedido_id", sql.Int, pedido_id)
      .query("SELECT id FROM pedidos WHERE id = @pedido_id");

    // 4) Se não existir, espelha em UM ÚNICO BATCH (TRY/CATCH) numa conexão dedicada
    if (!ped.recordset.length) {
      const dedicated = await new sql.ConnectionPool(dbConfig).connect();
      try {
        const reqD = new sql.Request(dedicated)
          .input("id", sql.Int, pedido_id)
          .input("cliente_id", sql.Int, b.recordset[0].cliente_id)
          .input("valor_total", sql.Decimal(18, 2), valor_pedido ?? 0);

        await reqD.query(`
          BEGIN TRY
            SET IDENTITY_INSERT dbo.pedidos ON;

            INSERT INTO dbo.pedidos (id, cliente_id, valor_total, data_pedido)
            VALUES (@id, @cliente_id, @valor_total, SYSUTCDATETIME());

            SET IDENTITY_INSERT dbo.pedidos OFF;
          END TRY
          BEGIN CATCH
            BEGIN TRY
              SET IDENTITY_INSERT dbo.pedidos OFF;
            END TRY
            BEGIN CATCH
              -- se já estiver OFF, ignora
            END CATCH;

            DECLARE @msg nvarchar(4000) = ERROR_MESSAGE();
            DECLARE @num int = ERROR_NUMBER();
            RAISERROR(@msg, 16, 1);
          END CATCH;
        `);
      } catch (e: any) {
        // erro ao espelhar (ex.: 544: conflito de IDENTITY_INSERT)
        await dedicated.close();
        return res.status(500).json({
          message:
            "A tabela 'pedidos' usa IDENTITY. Tente novamente (o IDENTITY_INSERT pode ter conflitado nesta sessão).",
          error: e?.message ?? String(e),
        });
      }
      await dedicated.close();
    }

    // 5) Vincula e (opcional) gera SAÍDA "PEDIDO"
    const tx2 = new sql.Transaction(pool);
    await tx2.begin();
    try {
      const vinculo = await new sql.Request(tx2)
        .input("bloco_id", sql.Int, +bloco_id)
        .input("pedido_id", sql.Int, pedido_id)
        .query(`
          INSERT INTO bloco_pedidos (bloco_id, pedido_id)
          OUTPUT INSERTED.*
          VALUES (@bloco_id, @pedido_id)
        `);

      let lancGerado = false;
      if (valor_pedido && valor_pedido > 0) {
        await new sql.Request(tx2)
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
        lancGerado = true;
      }

      await tx2.commit();
      return res.status(201).json({
        message: "Pedido vinculado ao bloco com sucesso",
        data: vinculo.recordset[0],
        lancamento_gerado: lancGerado,
      });
    } catch (e) {
      await tx2.rollback();
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


export const addLancamentoToBloco = async (req: AuthenticatedRequest, res: Response) => {
  const { id: bloco_id } = req.params;

  try {
    const raw = addLancamentoSchema.parse(req.body);

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

    // regras para CHEQUE
    if (raw.tipo_recebimento === "CHEQUE") {
      if (!raw.tipo_cheque) {
        return res.status(400).json({ message: "tipo_cheque é obrigatório para CHEQUE." });
      }
      if (!bomParaISO) {
        return res.status(400).json({ message: "bom_para é obrigatório para CHEQUE." });
      }
    }

    const userId = req.user?.id ?? null;
    const sentido = mapRecebimentoToSentido(raw.tipo_recebimento);

    const result = await pool
      .request()
      .input("bloco_id", sql.Int, +bloco_id)
      .input("tipo_recebimento", sql.VarChar(30), raw.tipo_recebimento)
      .input("valor", sql.Decimal(18, 2), valor)
      .input("data_lancamento", sql.DateTime2, dataISO)
      .input("bom_para", sql.DateTime2, bomParaISO)
      .input("tipo_cheque", sql.VarChar(15), raw.tipo_cheque ?? null)
      .input("numero_referencia", sql.VarChar(100), raw.numero_referencia ?? null)
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
        await new sql.Request(tx).input("id", sql.Int, saida.id).query(
          "DELETE FROM bloco_lancamentos WHERE id=@id"
        );
      } else {
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

/* ========================= Listagens ========================= */

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
