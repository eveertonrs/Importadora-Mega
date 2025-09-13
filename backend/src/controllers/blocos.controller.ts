import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";

const createBlocoSchema = z.object({
  cliente_id: z.number().int("ID do cliente deve ser um inteiro"),
  codigo: z.string().optional(),
  observacao: z.string().optional(),
});

export const createBloco = async (req: Request, res: Response) => {
  try {
    const { cliente_id, codigo, observacao } = createBlocoSchema.parse(req.body);

    const result = await pool
      .request()
      .input("cliente_id", cliente_id)
      .input("codigo", codigo)
      .input("observacao", observacao)
      .query(
        `INSERT INTO blocos (cliente_id, codigo, observacao, status, aberto_em)
         OUTPUT INSERTED.*
         VALUES (@cliente_id, @codigo, @observacao, 'ABERTO', GETDATE())`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const addPedidoSchema = z.object({
  pedido_id: z.number().int("ID do pedido deve ser um inteiro"),
});

export const addPedidoToBloco = async (req: Request, res: Response) => {
  const { id: bloco_id } = req.params;
  try {
    const { pedido_id } = addPedidoSchema.parse(req.body);

    // TODO: Adicionar transação para garantir atomicidade
    // TODO: Validar se o pedido já não está em outro bloco

    const result = await pool
      .request()
      .input("bloco_id", bloco_id)
      .input("pedido_id", pedido_id)
      .query(
        `INSERT INTO bloco_pedidos (bloco_id, pedido_id)
         OUTPUT INSERTED.*
         VALUES (@bloco_id, @pedido_id)`
      );

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao adicionar pedido ao bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

const addLancamentoSchema = z.object({
  tipo_recebimento: z.string(),
  valor: z.number(),
  data_lancamento: z.string().datetime(),
  bom_para: z.string().datetime().optional(),
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().optional(),
  status: z.enum(["PENDENTE", "LIQUIDADO", "DEVOLVIDO", "CANCELADO"]).default("PENDENTE"),
  observacao: z.string().optional(),
});

export const addLancamentoToBloco = async (req: Request, res: Response) => {
  const { id: bloco_id } = req.params;
  try {
    const data = addLancamentoSchema.parse(req.body);

    const result = await pool
      .request()
      .input("bloco_id", bloco_id)
      .input("tipo_recebimento", data.tipo_recebimento)
      .input("valor", data.valor)
      .input("data_lancamento", data.data_lancamento)
      .input("bom_para", data.bom_para)
      .input("tipo_cheque", data.tipo_cheque)
      .input("numero_referencia", data.numero_referencia)
      .input("status", data.status)
      .input("observacao", data.observacao)
      .query(
        `INSERT INTO bloco_lancamentos (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque, numero_referencia, status, observacao)
         OUTPUT INSERTED.*
         VALUES (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque, @numero_referencia, @status, @observacao)`
      );

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
      .input("bloco_id", id)
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
    // Primeiro, verifica o saldo usando a view
    const saldoResult = await pool
      .request()
      .input("bloco_id", id)
      .query("SELECT saldo FROM vw_blocos_saldo WHERE bloco_id = @bloco_id");

    if (saldoResult.recordset.length === 0) {
      return res.status(404).json({ message: "Bloco não encontrado" });
    }

    const saldo = saldoResult.recordset[0].saldo;

    if (saldo !== 0) {
      return res.status(400).json({ message: `Não é possível fechar o bloco. Saldo atual: ${saldo}` });
    }

    // Se o saldo for zero, fecha o bloco
    const result = await pool
      .request()
      .input("id", id)
      .query(
        `UPDATE blocos 
         SET status = 'FECHADO', fechado_em = GETDATE() 
         OUTPUT INSERTED.* 
         WHERE id = @id AND status = 'ABERTO'`
      );
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Bloco não encontrado ou já está fechado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao fechar bloco:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
