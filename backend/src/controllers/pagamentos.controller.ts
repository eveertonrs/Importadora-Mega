// src/controllers/pagamentos.controller.ts
import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import sql from "mssql";

// schema para criação/atualização de “pagamento” (lançamento)
const pagamentoSchema = z.object({
  cliente_id: z.number().int(),
  // no seu código você usa .datetime() em outros pontos; manterei por consistência
  data_lancamento: z.string().datetime(),
  data_vencimento: z.string().datetime().optional(), // mapeia para bom_para
  valor: z.number().positive(),
  forma_pagamento: z.string(), // mapeia para tipo_recebimento
  observacoes: z.string().optional(),
  tipo_cheque: z.enum(["PROPRIO", "TERCEIRO"]).optional(),
  numero_referencia: z.string().optional(),
  bloco_id: z.number().int().optional(),
});

export const getPagamentos = async (req: Request, res: Response) => {
  try {
    const { cliente_id, status, tipo_recebimento } = req.query as {
      cliente_id?: string;
      status?: "PENDENTE" | "LIQUIDADO" | "DEVOLVIDO" | "CANCELADO";
      tipo_recebimento?: string;
    };

    let query = `
      SELECT bl.*,
             b.cliente_id,
             c.nome_fantasia,
             b.status AS status_bloco
      FROM bloco_lancamentos bl
      JOIN blocos b ON bl.bloco_id = b.id
      JOIN clientes c ON b.cliente_id = c.id
      WHERE 1 = 1
    `;

    const request = pool.request();

    if (cliente_id) {
      query += " AND b.cliente_id = @cliente_id";
      request.input("cliente_id", Number(cliente_id));
    }

    if (status) {
      query += " AND bl.status = @status";
      request.input("status", status);
    }

    if (tipo_recebimento) {
      query += " AND bl.tipo_recebimento = @tipo_recebimento";
      request.input("tipo_recebimento", tipo_recebimento);
    }

    query += " ORDER BY bl.data_lancamento DESC, bl.id DESC";

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar pagamentos (lançamentos):", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getPagamentoById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool
      .request()
      .input("id", id)
      .query(`
        SELECT bl.*,
               b.cliente_id,
               c.nome_fantasia
        FROM bloco_lancamentos bl
        JOIN blocos b ON bl.bloco_id = b.id
        JOIN clientes c ON b.cliente_id = c.id
        WHERE bl.id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Erro ao buscar lançamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const createPagamento = async (req: Request, res: Response) => {
  try {
    const data = pagamentoSchema.parse(req.body);

    // Inicia transação (precisamos possivelmente criar o bloco)
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let blocoId = data.bloco_id;

      // Se não informaram bloco, localiza um bloco ABERTO do cliente ou cria
      if (!blocoId) {
        const findReq = new sql.Request(transaction);
        const openBloco = await findReq
          .input("cliente_id", data.cliente_id)
          .query(`
            SELECT TOP 1 id
            FROM blocos
            WHERE cliente_id = @cliente_id AND status = 'ABERTO'
            ORDER BY aberto_em DESC
          `);

        if (openBloco.recordset.length > 0) {
          blocoId = openBloco.recordset[0].id;
        } else {
          const codigoAuto = `AUTO-${new Date()
            .toISOString()
            .replace(/[-:T.Z]/g, "")
            .slice(0, 12)}`; // AUTO-YYYYMMDDHHMM

          const createBlocoReq = new sql.Request(transaction);
          const novoBloco = await createBlocoReq
            .input("cliente_id", data.cliente_id)
            .input("codigo", codigoAuto)
            .input("observacao", "Criado automaticamente ao inserir lançamento")
            .query(`
              INSERT INTO blocos (cliente_id, codigo, status, aberto_em, observacao)
              OUTPUT INSERTED.id
              VALUES (@cliente_id, @codigo, 'ABERTO', SYSDATETIME(), @observacao)
            `);

          blocoId = novoBloco.recordset[0].id;
        }
      } else {
        // Validar se o bloco existe, está ABERTO e pertence ao cliente informado
        const validateReq = new sql.Request(transaction);
        const bloco = await validateReq
          .input("bloco_id", blocoId)
          .input("cliente_id", data.cliente_id)
          .query(`
            SELECT id FROM blocos
            WHERE id = @bloco_id AND cliente_id = @cliente_id AND status = 'ABERTO'
          `);

        if (bloco.recordset.length === 0) {
          await transaction.rollback();
          return res
            .status(400)
            .json({ message: "Bloco inválido: inexistente, fechado ou não pertence ao cliente." });
        }
      }

      // Inserir lançamento
      const insertReq = new sql.Request(transaction);
      const inserted = await insertReq
        .input("bloco_id", blocoId)
        .input("tipo_recebimento", data.forma_pagamento) // mapeamento
        .input("valor", data.valor)
        .input("data_lancamento", data.data_lancamento)
        .input("bom_para", data.data_vencimento ?? null)
        .input("tipo_cheque", data.tipo_cheque ?? null)
        .input("numero_referencia", data.numero_referencia ?? null)
        .input("status", "PENDENTE")
        .input("observacao", data.observacoes ?? null)
        .query(`
          INSERT INTO bloco_lancamentos
            (bloco_id, tipo_recebimento, valor, data_lancamento, bom_para, tipo_cheque, numero_referencia, status, observacao)
          OUTPUT INSERTED.*
          VALUES
            (@bloco_id, @tipo_recebimento, @valor, @data_lancamento, @bom_para, @tipo_cheque, @numero_referencia, @status, @observacao)
        `);

      await transaction.commit();
      res.status(201).json(inserted.recordset[0]);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar lançamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const updatePagamento = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Permitir atualizar apenas campos do lançamento (não muda cliente nem bloco aqui)
  const updateSchema = pagamentoSchema
    .omit({ cliente_id: true, bloco_id: true })
    .partial();

  try {
    const data = updateSchema.parse(req.body);

    const fields = Object.keys(data)
      .map((key) => {
        // mapear nomes do schema para colunas
        if (key === "forma_pagamento") return `tipo_recebimento = @${key}`;
        if (key === "data_vencimento") return `bom_para = @${key}`;
        if (key === "observacoes") return `observacao = @${key}`;
        return `${key} = @${key}`;
      })
      .join(", ");

    if (!fields) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    const request = pool.request().input("id", id);

    // bind com os nomes originais e o SQL faz o mapeamento ali em cima
    Object.entries(data).forEach(([key, value]) => {
      request.input(key, value as any);
    });

    const result = await request.query(`
      UPDATE bloco_lancamentos
         SET ${fields}
       OUTPUT INSERTED.*
       WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao atualizar lançamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const deletePagamento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool
      .request()
      .input("id", id)
      .query("DELETE FROM bloco_lancamentos WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }

    res.status(204).send();
  } catch (error: any) {
    // FK para fechamento_itens pode bloquear exclusão
    if (error?.number === 547) {
      return res
        .status(409)
        .json({ message: "Não é possível excluir: lançamento já vinculado a fechamento do dia." });
    }
    console.error("Erro ao deletar lançamento:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// Saldo consolidado do cliente em blocos ABERTOS
export const getSaldo = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;

  try {
    const result = await pool
      .request()
      .input("cliente_id", Number(cliente_id))
      .query(`
        SELECT COALESCE(SUM(v.saldo), 0) AS saldo
        FROM vw_blocos_saldo v
        JOIN blocos b ON b.id = v.bloco_id
        WHERE b.cliente_id = @cliente_id
          AND b.status = 'ABERTO'
      `);

    res.json({ saldo: result.recordset[0].saldo });
  } catch (error) {
    console.error("Erro ao buscar saldo:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};

// Histórico de lançamentos do cliente (todos os blocos)
export const getHistorico = async (req: Request, res: Response) => {
  const { cliente_id } = req.params;

  try {
    const result = await pool
      .request()
      .input("cliente_id", Number(cliente_id))
      .query(`
        SELECT bl.*,
               b.id AS bloco_id,
               b.codigo AS codigo_bloco,
               b.status AS status_bloco
        FROM bloco_lancamentos bl
        JOIN blocos b ON bl.bloco_id = b.id
        WHERE b.cliente_id = @cliente_id
        ORDER BY bl.data_lancamento DESC, bl.id DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ message: "Erro interno no servidor" });
  }
};
