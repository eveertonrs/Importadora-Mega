import { Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import sql from "mssql";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido. Use YYYY-MM-DD");

export const createFechamento = async (req: AuthenticatedRequest, res: Response) => {
  const { data_ref } = req.params;
  const userId = req.user!.id;

  try {
    const validatedDate = dateSchema.parse(data_ref);

    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      // trava linha do dia para evitar criação concorrente
      const existe = await new sql.Request(tx)
        .input("data_ref", sql.Date, validatedDate)
        .query(`
          SELECT 1
            FROM fechamento_dia WITH (UPDLOCK, HOLDLOCK)
           WHERE data_ref = @data_ref
        `);

      if (existe.recordset.length) {
        await tx.rollback();
        return res
          .status(409)
          .json({ message: `O fechamento para o dia ${validatedDate} já existe.` });
      }

      // cria cabeçalho
      await new sql.Request(tx)
        .input("data_ref", sql.Date, validatedDate)
        .input("criado_por", sql.Int, userId)
        .input("observacao", sql.NVarChar(sql.MAX), null)
        .query(`
          INSERT INTO fechamento_dia (data_ref, criado_por, criado_em, observacao)
          VALUES (@data_ref, @criado_por, SYSUTCDATETIME(), @observacao)
        `);

      // snapshot dos lançamentos do dia
      await new sql.Request(tx)
        .input("data_ref", sql.Date, validatedDate)
        .query(`
          INSERT INTO fechamento_itens (data_ref, lancamento_id, status_no_dia)
          SELECT @data_ref, bl.id, bl.status
            FROM bloco_lancamentos bl
           WHERE CAST(bl.data_lancamento AS date) = @data_ref
        `);

      await tx.commit();
      return res
        .status(201)
        .json({ message: `Fechamento para o dia ${validatedDate} criado com sucesso.` });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao criar fechamento:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

/**
 * Reprocessa o fechamento do dia: remove itens e recaptura o snapshot.
 * Mantém o cabeçalho.
 */
export const reprocessFechamento = async (req: AuthenticatedRequest, res: Response) => {
  const { data_ref } = req.params;
  try {
    const validatedDate = dateSchema.parse(data_ref);

    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      // garante que existe
      const cab = await new sql.Request(tx)
        .input("data_ref", sql.Date, validatedDate)
        .query(`SELECT 1 FROM fechamento_dia WHERE data_ref = @data_ref`);

      if (!cab.recordset.length) {
        await tx.rollback();
        return res
          .status(404)
          .json({ message: `Fechamento para o dia ${validatedDate} não encontrado.` });
      }

      // apaga itens e recarrega snapshot
      await new sql.Request(tx)
        .input("data_ref", sql.Date, validatedDate)
        .query(`DELETE FROM fechamento_itens WHERE data_ref = @data_ref`);

      await new sql.Request(tx)
        .input("data_ref", sql.Date, validatedDate)
        .query(`
          INSERT INTO fechamento_itens (data_ref, lancamento_id, status_no_dia)
          SELECT @data_ref, bl.id, bl.status
            FROM bloco_lancamentos bl
           WHERE CAST(bl.data_lancamento AS date) = @data_ref
        `);

      await tx.commit();
      return res.json({
        message: `Fechamento do dia ${validatedDate} reprocessado com sucesso.`,
      });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao reprocessar fechamento:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};

export const getFechamento = async (req: AuthenticatedRequest, res: Response) => {
  const { data_ref } = req.params;
  try {
    const validatedDate = dateSchema.parse(data_ref);

    // cabeçalho
    const cab = await pool
      .request()
      .input("data_ref", sql.Date, validatedDate)
      .query(`SELECT * FROM fechamento_dia WHERE data_ref = @data_ref`);

    if (!cab.recordset.length) {
      return res
        .status(404)
        .json({ message: `Fechamento para o dia ${validatedDate} não encontrado.` });
    }

    // itens detalhados
    const itens = await pool
      .request()
      .input("data_ref", sql.Date, validatedDate)
      .query(`
        SELECT
          fi.*,
          bl.tipo_recebimento,
          bl.tipo_cheque,
          bl.sentido,
          bl.valor,
          bl.bom_para,
          c.nome_fantasia,
          b.codigo AS codigo_bloco
        FROM fechamento_itens fi
        JOIN bloco_lancamentos bl ON fi.lancamento_id = bl.id
        JOIN blocos b            ON bl.bloco_id = b.id
        JOIN clientes c          ON b.cliente_id = c.id
        WHERE fi.data_ref = @data_ref
        ORDER BY bl.tipo_recebimento, bl.bom_para, fi.lancamento_id
      `);

    // agregados
    const geraisRs = await pool
      .request()
      .input("data_ref", sql.Date, validatedDate)
      .query(`
        SELECT
          COUNT(*) AS qtde_itens,
          SUM(CASE WHEN bl.sentido='ENTRADA' THEN bl.valor ELSE 0 END) AS total_entradas,
          SUM(CASE WHEN bl.sentido='SAIDA'   THEN bl.valor ELSE 0 END) AS total_saidas
        FROM fechamento_itens fi
        JOIN bloco_lancamentos bl ON fi.lancamento_id = bl.id
        WHERE fi.data_ref = @data_ref
      `);

    const porStatusRs = await pool
      .request()
      .input("data_ref", sql.Date, validatedDate)
      .query(`
        SELECT bl.status, COUNT(*) AS qtd, SUM(bl.valor) AS total
        FROM fechamento_itens fi
        JOIN bloco_lancamentos bl ON fi.lancamento_id = bl.id
        WHERE fi.data_ref = @data_ref
        GROUP BY bl.status
      `);

    const porFormaRs = await pool
      .request()
      .input("data_ref", sql.Date, validatedDate)
      .query(`
        SELECT bl.tipo_recebimento, COUNT(*) AS qtd, SUM(bl.valor) AS total
        FROM fechamento_itens fi
        JOIN bloco_lancamentos bl ON fi.lancamento_id = bl.id
        WHERE fi.data_ref = @data_ref
        GROUP BY bl.tipo_recebimento
        ORDER BY bl.tipo_recebimento
      `);

    return res.json({
      ...cab.recordset[0],
      itens: itens.recordset,
      resumo: {
        gerais: geraisRs.recordset[0] ?? null,
        por_status: porStatusRs.recordset,
        por_forma: porFormaRs.recordset,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Erro de validação", errors: error.errors });
    }
    console.error("Erro ao buscar fechamento:", error);
    return res.status(500).json({ message: "Erro interno no servidor" });
  }
};
