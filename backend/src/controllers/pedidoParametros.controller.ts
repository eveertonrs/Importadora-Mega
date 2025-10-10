import { Request, Response } from "express";
import { pool, sql } from "../db";

/** GET /pedido-parametros?tipo=ENTRADA|SAIDA&ativo=true|false|all&q=... */
export async function list(req: Request, res: Response) {
  const { tipo, ativo = "all", q } = req.query as any;

  const where: string[] = [];
  const r = new sql.Request(pool);

  if (tipo) {
    where.push("tipo = @tipo");
    r.input("tipo", sql.VarChar(10), String(tipo).toUpperCase());
  }
  if (ativo !== "all") {
    where.push("ativo = @ativo");
    r.input("ativo", sql.Bit, String(ativo) === "true");
  }
  if (q) {
    where.push("descricao LIKE @q");
    r.input("q", sql.VarChar, `%${String(q)}%`);
  }

  const query = `
    SELECT id, tipo, descricao, ativo, created_at
    FROM dbo.pedido_parametros
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY tipo, descricao
  `;

  const { recordset } = await r.query(query);
  res.json(recordset);
}

/** POST /pedido-parametros { tipo, descricao } */
export async function create(req: Request, res: Response) {
  const { tipo, descricao } = req.body || {};
  if (!tipo || !descricao) {
    return res.status(400).json({ message: "tipo e descricao são obrigatórios." });
  }

  const r = new sql.Request(pool)
    .input("tipo", sql.VarChar(10), String(tipo).toUpperCase())
    .input("descricao", sql.VarChar(200), String(descricao).trim());

  const query = `
    INSERT INTO dbo.pedido_parametros (tipo, descricao)
    OUTPUT INSERTED.*
    VALUES (@tipo, @descricao)
  `;

  const { recordset } = await r.query(query);
  res.status(201).json(recordset[0]);
}

/** PUT /pedido-parametros/:id { descricao?, ativo?, tipo? } */
export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { descricao, ativo, tipo } = req.body || {};
  if (!id) return res.status(400).json({ message: "id inválido" });

  const sets: string[] = [];
  const r = new sql.Request(pool).input("id", sql.Int, id);

  if (descricao !== undefined) {
    sets.push("descricao = @descricao");
    r.input("descricao", sql.VarChar(200), String(descricao).trim());
  }
  if (ativo !== undefined) {
    sets.push("ativo = @ativo");
    r.input("ativo", sql.Bit, !!ativo);
  }
  if (tipo !== undefined) {
    sets.push("tipo = @tipo");
    r.input("tipo", sql.VarChar(10), String(tipo).toUpperCase());
  }

  if (!sets.length) return res.status(400).json({ message: "Nada para atualizar." });

  const query = `
    UPDATE dbo.pedido_parametros
      SET ${sets.join(", ")}
    OUTPUT INSERTED.*
    WHERE id = @id
  `;

  const { recordset } = await r.query(query);
  res.json(recordset[0]);
}

/** DELETE /pedido-parametros/:id  → alterna ativo/inativo */
export async function toggle(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "id inválido" });

  const r = new sql.Request(pool).input("id", sql.Int, id);
  const query = `
    UPDATE dbo.pedido_parametros
      SET ativo = IIF(ativo = 1, 0, 1)
    OUTPUT INSERTED.*
    WHERE id = @id
  `;

  const { recordset } = await r.query(query);
  res.json(recordset[0]);
}
