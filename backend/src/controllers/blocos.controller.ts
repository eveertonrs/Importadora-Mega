import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import sql from "mssql";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const createBlocoSchema = z.object({
  cliente_id: z.number().int("ID do cliente deve ser um inteiro"),
  codigo: z.string().optional(),
  observacao: z.string().optional(),
});

const addPedidoSchema = z.object({
  pedido_id: z.number().int("ID do pedido deve ser um inteiro"),
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
] as const;

const addLancamentoSchema = z.object({
  tipo_recebimento: z.enum(allowedRecebimentos),
  valor: z.number(),
  data_lancamento: z.string().datetime(),
  bom_para: z.string().datetime().optional(),
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().optional(),
  status: z.enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"]).default("PENDENTE"),
  observacao: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.tipo_recebimento === "CHEQUE") {
    if (!data.tipo_cheque) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "tipo_cheque é obrigatório para CHEQUE", path: ["tipo_cheque"] });
    }
    if (!data.bom_para) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bom_para é obrigatório para CHEQUE", path: ["bom_para"] });
    }
  }
});

const gerarCodigo = (clienteId: number) =>
  `B${clienteId}-${Date.now().toString(36).toUpperCase()}`;

export const createBloco = async (req: Request, res: Response) => {
  try {
    const { cliente_id, codigo, observacao } = createBlocoSchema.parse(req.body);
    const finalCodigo = codigo ?? gerarCodigo(cliente_id);

    const result = await pool
      .request()
      .input("cliente_id", cliente_id)
      .input("codigo", finalCodigo)
      .input("observacao", observacao ?? null)
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
    // unique (cliente_id, codigo, status)
    if ((error as any).number === 2627) {
      return res.status(409).json({ message: "Já existe um bloco ABERTO com este código para o cliente" });
    }
    console.error("Erro ao criar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const addPedidoToBloco = async (req: Request, res: Response) => {
  const { id: bloco_id } = req.params;
  try {
    const { pedido_id } = addPedidoSchema.parse(req.body);

    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      const reqTx = new sql.Request(tx);

      // bloco deve existir e estar ABERTO
      const bloco = await reqTx
        .input("bloco_id", +bloco_id)
        .query("SELECT id, status FROM blocos WHERE id = @bloco_id");

      if (bloco.recordset.length === 0) {
        await tx.rollback();
        return res.status(404).json({ message: "Bloco não encontrado" });
      }
      if (bloco.recordset[0].status !== "ABERTO") {
        await tx.rollback();
        return res.status(400).json({ message: "Não é possível adicionar pedido em bloco FECHADO" });
      }

      // pedido não pode estar em outro bloco
      const jaVinculado = await reqTx
        .input("pedido_id", pedido_id)
        .query("SELECT 1 FROM bloco_pedidos WHERE pedido_id = @pedido_id");

      if (jaVinculado.recordset.length) {
        await tx.rollback();
        return res.status(409).json({ message: "Pedido já está vinculado a outro bloco" });
      }

      const inserted = await reqTx
        .input("bloco_id", +bloco_id)
        .input("pedido_id", pedido_id)
        .query(`
          INSERT INTO bloco_pedidos (bloco_id, pedido_id)
          OUTPUT INSERTED.*
          VALUES (@bloco_id, @pedido_id)
        `);

      await tx.commit();
      res.status(201).json(inserted.recordset[0]);
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

    const result = await pool
      .request()
      .input("bloco_id", +bloco_id)
      .input("tipo_recebimento", data.tipo_recebimento)
      .input("valor", data.valor)
      .input("data_lancamento", data.data_lancamento)
      .input("bom_para", data.bom_para ?? null)
      .input("tipo_cheque", data.tipo_cheque ?? null)
      .input("numero_referencia", data.numero_referencia ?? null)
      .input("status", data.status)
      .input("observacao", data.observacao ?? null)
      .input("criado_por", userId)
      .query(`
        INSERT INTO bloco_lancamentos
          (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque, numero_referencia, status, observacao, criado_por)
        OUTPUT INSERTED.*
        VALUES
          (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque, @numero_referencia, @status, @observacao, @criado_por)
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
      .input("bloco_id", +id)
      .query("SELECT * FROM vw_blocos_saldo WHERE bloco_id = @bloco_id");

    if (result.recordset.length === 0) {
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
      .input("bloco_id", +id)
      .query("SELECT saldo FROM vw_blocos_saldo WHERE bloco_id = @bloco_id");

    if (saldoResult.recordset.length === 0) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }

    const saldo: number = saldoResult.recordset[0].saldo ?? 0;
    if (Number(saldo) !== 0) {
      return res.status(400).json({ message: `Não é possível fechar o bloco. Saldo atual: ${saldo}` });
    }

    const result = await pool
      .request()
      .input("id", +id)
      .query(`
        UPDATE blocos
        SET status = 'FECHADO', fechado_em = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @id AND status = 'ABERTO'
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Bloco não encontrado ou já está fechado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao fechar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
