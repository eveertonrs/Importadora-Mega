import { Request, Response } from "express";
import { pool } from "../db";

/**
 * GET /clientes/:id/transportadoras
 * Lista transportadoras vinculadas ao cliente
 */
export async function listarDoCliente(req: Request, res: Response) {
  const clienteId = Number(req.params.id);
  if (!Number.isFinite(clienteId)) {
    return res.status(400).json({ message: "id inválido" });
  }

  // IMPORTANTE: nada de nome_fantasia nem observacao, pois não existem no seu schema atual
  const sql = `
    SELECT
      ct.cliente_id,
      t.id                AS transportadora_id,
      ct.principal,
      t.razao_social,
      t.cnpj,
      t.telefone
    FROM dbo.cliente_transportadoras ct
    JOIN dbo.transportadoras t ON t.id = ct.transportadora_id
    WHERE ct.cliente_id = @clienteId
    ORDER BY ct.principal DESC, t.razao_social
  `;

  const result = await pool.request().input("clienteId", clienteId).query(sql);
  return res.json({ data: result.recordset ?? [] });
}

/**
 * POST /clientes/:id/transportadoras
 * body: { transportadora_id, principal? }
 */
export async function vincular(req: Request, res: Response) {
  const clienteId = Number(req.params.id);
  const { transportadora_id, principal, observacao } = req.body ?? {};
  const tid = Number(transportadora_id);

  if (!Number.isFinite(clienteId) || !Number.isFinite(tid)) {
    return res.status(400).json({ message: "Parâmetros inválidos." });
  }

  const tx = pool.transaction();
  await tx.begin();

  try {
    // se marcar como principal, zera as demais primeiro
    if (principal === true) {
      await tx
        .request()
        .input("clienteId", clienteId)
        .query(`
          UPDATE dbo.cliente_transportadoras
             SET principal = 0,
                 updated_at = SYSUTCDATETIME()
           WHERE cliente_id = @clienteId
        `);
    }

    // 1) tenta atualizar o vínculo
    const upd = await tx
      .request()
      .input("clienteId", clienteId)
      .input("tid", tid)
      .input("principal", principal == null ? null : (principal ? 1 : 0))
      .input("observacao", observacao ?? null)
      .query(`
        UPDATE dbo.cliente_transportadoras
           SET principal  = COALESCE(@principal, principal),
               observacao = COALESCE(@observacao, observacao),
               updated_at = SYSUTCDATETIME()
         WHERE cliente_id = @clienteId
           AND transportadora_id = @tid
      `);

    // 2) se não atualizou ninguém, insere
    if ((upd.rowsAffected?.[0] ?? 0) === 0) {
      await tx
        .request()
        .input("clienteId", clienteId)
        .input("tid", tid)
        .input("principal", principal ? 1 : 0)
        .input("observacao", observacao ?? null)
        .query(`
          INSERT INTO dbo.cliente_transportadoras
            (cliente_id, transportadora_id, principal, observacao, created_at, updated_at)
          VALUES
            (@clienteId, @tid, @principal, @observacao, SYSUTCDATETIME(), SYSUTCDATETIME())
        `);
    }

    // 3) retorna o vínculo (e já pode trazer dados da transportadora se quiser)
    const sel = await tx
      .request()
      .input("clienteId", clienteId)
      .input("tid", tid)
      .query(`
        SELECT TOP 1
          ct.cliente_id,
          ct.transportadora_id,
          ct.principal,
          ct.observacao
        FROM dbo.cliente_transportadoras ct
        WHERE ct.cliente_id = @clienteId
          AND ct.transportadora_id = @tid
      `);

    await tx.commit();
    return res.status(201).json({ ok: true, data: sel.recordset?.[0] ?? null });
  } catch (err) {
    await tx.rollback();
    console.error("Erro em vincular transportadora:", err);
    return res.status(500).json({ message: (err as any)?.message || "Erro interno" });
  }
}

/**
 * PATCH /clientes/:id/transportadoras/:tid
 * body: { principal? }
 */
export async function atualizar(req: Request, res: Response) {
  const clienteId = Number(req.params.id);
  const tid = Number(req.params.tid);
  const { principal } = req.body ?? {};

  if (!Number.isFinite(clienteId) || !Number.isFinite(tid)) {
    return res.status(400).json({ message: "Parâmetros inválidos." });
  }

  if (principal === true) {
    await pool
      .request()
      .input("clienteId", clienteId)
      .query(
        `UPDATE dbo.cliente_transportadoras
           SET principal = 0, updated_at = SYSUTCDATETIME()
         WHERE cliente_id = @clienteId`
      );
  }

  const sql = `
    UPDATE dbo.cliente_transportadoras
       SET principal  = COALESCE(@principal, principal),
           updated_at = SYSUTCDATETIME()
     WHERE cliente_id = @clienteId AND transportadora_id = @tid
  `;

  await pool
    .request()
    .input("clienteId", clienteId)
    .input("tid", tid)
    .input("principal", principal == null ? null : principal ? 1 : 0)
    .query(sql);

  return res.json({ ok: true });
}

/**
 * DELETE /clientes/:id/transportadoras/:tid
 */
export async function remover(req: Request, res: Response) {
  const clienteId = Number(req.params.id);
  const tid = Number(req.params.tid);

  if (!Number.isFinite(clienteId) || !Number.isFinite(tid)) {
    return res.status(400).json({ message: "Parâmetros inválidos." });
  }

  await pool
    .request()
    .input("clienteId", clienteId)
    .input("tid", tid)
    .query(
      `DELETE FROM dbo.cliente_transportadoras
        WHERE cliente_id = @clienteId AND transportadora_id = @tid`
    );

  return res.json({ ok: true });
}
