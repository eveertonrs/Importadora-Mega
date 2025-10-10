import { Request, Response } from "express";
import { pool, sql } from "../db";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// Helper para status após baixa
function nextStatus(valorBruto: number, valorBaixado: number, current: string) {
  if (current === "DEVOLVIDO" || current === "CANCELADO") return current;
  if (valorBaixado <= 0) return "ABERTO";
  if (valorBaixado >= valorBruto) return "BAIXADO";
  return "PARCIAL";
}

export async function listTitulos(req: Request, res: Response) {
  const {
    status = "ABERTO,PARCIAL",
    tipo,
    cliente_id,
    from,
    to,
    q,
    page = "1",
    pageSize = "25",
  } = req.query as any;

  const where: string[] = [];
  const r = new sql.Request(pool);

  if (status !== "all") {
    const items = String(status).split(",").map((s) => s.trim());
    where.push(`status IN (${items.map((_, i) => `@st${i}`).join(",")})`);
    items.forEach((s, i) => r.input(`st${i}`, sql.VarChar, s));
  }

  if (tipo)        { where.push("tipo = @tipo");             r.input("tipo", sql.VarChar, String(tipo)); }
  if (cliente_id)  { where.push("cliente_id = @cliente_id"); r.input("cliente_id", sql.Int, Number(cliente_id)); }
  if (from)        { where.push("bom_para >= @from");        r.input("from", sql.Date, from); }
  if (to)          { where.push("bom_para <= @to");          r.input("to", sql.Date, to); }
  if (q)           { where.push("(numero_doc LIKE @q OR observacao LIKE @q)"); r.input("q", sql.VarChar, `%${q}%`); }

  const pageN = Math.max(1, Number(page));
  const sizeN = Math.max(1, Math.min(200, Number(pageSize)));
  const off   = (pageN - 1) * sizeN;

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  // -------- Importante: usar BATCH, mas “tipar” o retorno para evitar os erros TS7053
  const sqlText = `
    SELECT COUNT(1) AS total
    FROM dbo.financeiro_titulos
    ${whereSql};

    SELECT *
    FROM dbo.financeiro_titulos
    ${whereSql}
    ORDER BY bom_para ASC, id ASC
    OFFSET ${off} ROWS FETCH NEXT ${sizeN} ROWS ONLY;
  `;

  // A tipagem de retorno do mssql para .batch é ruim: fazemos um cast seguro
  const rs = (await r.batch(sqlText)) as unknown as {
    recordsets: Array<Array<any>>;
  };

  const total = rs.recordsets?.[0]?.[0]?.total ?? 0;
  const data  = rs.recordsets?.[1] ?? [];
  res.json({ total, page: pageN, pageSize: sizeN, data });
}

export async function createTitulo(req: AuthenticatedRequest, res: Response) {
  const {
    cliente_id, tipo, bom_para, valor_bruto,
    numero_doc, banco, agencia, conta,
    forma_id, bloco_id, observacao
  } = req.body || {};

  if (!cliente_id || !tipo || !bom_para || !valor_bruto) {
    return res.status(400).json({ message: "cliente_id, tipo, bom_para, valor_bruto são obrigatórios" });
  }

  const r = new sql.Request(pool);
  r.input("cliente_id", sql.Int, cliente_id);
  r.input("tipo",       sql.VarChar, String(tipo).toUpperCase());
  r.input("bom_para",   sql.Date, bom_para);
  r.input("valor",      sql.Decimal(18,2), valor_bruto);
  r.input("numero",     sql.VarChar, numero_doc ?? null);
  r.input("banco",      sql.VarChar, banco ?? null);
  r.input("agencia",    sql.VarChar, agencia ?? null);
  r.input("conta",      sql.VarChar, conta ?? null);
  r.input("forma_id",   sql.Int, forma_id ?? null);
  r.input("bloco_id",   sql.Int, bloco_id ?? null);
  r.input("obs",        sql.VarChar, observacao ?? null);
  r.input("created_by", sql.Int, req.user!.id);

  const q = `
    INSERT INTO dbo.financeiro_titulos
      (cliente_id, tipo, forma_id, numero_doc, banco, agencia, conta, bom_para, valor_bruto, valor_baixado, status, observacao, bloco_id, created_by)
    OUTPUT INSERTED.*
    VALUES
      (@cliente_id, @tipo, @forma_id, @numero, @banco, @agencia, @conta, @bom_para, @valor, 0, 'ABERTO', @obs, @bloco_id, @created_by);
  `;
  const rs = await r.query(q);
  res.status(201).json(rs.recordset[0]);
}

export async function updateTitulo(req: Request, res: Response) {
  const { id } = req.params as any;
  const { numero_doc, banco, agencia, conta, bom_para, observacao, status } = req.body || {};

  const sets: string[] = [];
  const r = new sql.Request(pool).input("id", sql.Int, Number(id));

  if (numero_doc !== undefined) { sets.push("numero_doc = @numero_doc"); r.input("numero_doc", sql.VarChar, numero_doc); }
  if (banco      !== undefined) { sets.push("banco = @banco");           r.input("banco", sql.VarChar, banco); }
  if (agencia    !== undefined) { sets.push("agencia = @agencia");       r.input("agencia", sql.VarChar, agencia); }
  if (conta      !== undefined) { sets.push("conta = @conta");           r.input("conta", sql.VarChar, conta); }
  if (bom_para   !== undefined) { sets.push("bom_para = @bom_para");     r.input("bom_para", sql.Date, bom_para); }
  if (observacao !== undefined) { sets.push("observacao = @obs");        r.input("obs", sql.VarChar, observacao); }
  if (status     !== undefined) { sets.push("status = @status");         r.input("status", sql.VarChar, status); }

  if (!sets.length) return res.status(400).json({ message: "Nada para atualizar." });

  const q = `
    UPDATE dbo.financeiro_titulos
       SET ${sets.join(", ")}, updated_at = SYSUTCDATETIME()
     OUTPUT INSERTED.*
     WHERE id = @id;
  `;
  const rs = await r.query(q);
  res.json(rs.recordset[0]);
}

export async function registrarBaixa(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params as any;
  const { valor_baixa, data_baixa, forma_pagto, obs } = req.body || {};
  if (!valor_baixa || Number(valor_baixa) <= 0) return res.status(400).json({ message: "valor_baixa inválido" });

  const r1 = await new sql.Request(pool).input("id", sql.Int, Number(id))
    .query("SELECT * FROM dbo.financeiro_titulos WHERE id = @id");
  const titulo = r1.recordset[0];
  if (!titulo) return res.status(404).json({ message: "Título não encontrado" });
  if (["DEVOLVIDO","CANCELADO","BAIXADO"].includes(titulo.status))
    return res.status(400).json({ message: `Não é possível baixar um título em status ${titulo.status}` });

  const novoBaixado = Number(titulo.valor_baixado) + Number(valor_baixa);
  if (novoBaixado - Number(titulo.valor_bruto) > 0.0001)
    return res.status(400).json({ message: "Baixa excede o valor do título" });

  const novoStatus = nextStatus(Number(titulo.valor_bruto), novoBaixado, titulo.status);

  const tr = new sql.Transaction(pool);
  await tr.begin();

  try {
    const rIns = new sql.Request(tr);
    rIns.input("titulo_id",  sql.Int, Number(id));
    rIns.input("valor",      sql.Decimal(18,2), valor_baixa);
    rIns.input("data_baixa", sql.DateTime2, data_baixa ?? new Date());
    rIns.input("forma",      sql.VarChar, forma_pagto ?? null);
    rIns.input("obs",        sql.VarChar, obs ?? null);
    rIns.input("user_id",    sql.Int, (req.user?.id ?? 0));

    await rIns.query(`
      INSERT INTO dbo.financeiro_baixas (titulo_id, data_baixa, valor_baixa, forma_pagto, obs, user_id)
      VALUES (@titulo_id, @data_baixa, @valor, @forma, @obs, @user_id);
    `);

    const rUp = new sql.Request(tr);
    rUp.input("id",          sql.Int, Number(id));
    rUp.input("baixado",     sql.Decimal(18,2), novoBaixado);
    rUp.input("status",      sql.VarChar, novoStatus);

    const rsUp = await rUp.query(`
      UPDATE dbo.financeiro_titulos
         SET valor_baixado = @baixado,
             status = @status,
             updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE id = @id;
    `);

    await tr.commit();
    res.json({ titulo: rsUp.recordset[0] });
  } catch (err) {
    await tr.rollback();
    throw err;
  }
}

export async function listarBaixas(req: Request, res: Response) {
  const { id } = req.params as any;
  const rs = await new sql.Request(pool)
    .input("id", sql.Int, Number(id))
    .query(`SELECT * FROM dbo.financeiro_baixas WHERE titulo_id = @id ORDER BY data_baixa DESC, id DESC`);
  res.json(rs.recordset);
}

export async function saldoCliente(req: Request, res: Response) {
  const { clienteId } = req.params as any;
  const rs = await new sql.Request(pool)
    .input("clienteId", sql.Int, Number(clienteId))
    .query(`
      SELECT
        SUM(CASE WHEN status IN ('ABERTO','PARCIAL') THEN (valor_bruto - valor_baixado) ELSE 0 END) AS em_aberto
      FROM dbo.financeiro_titulos
      WHERE cliente_id = @clienteId;
    `);
  res.json({ cliente_id: Number(clienteId), em_aberto: Number(rs.recordset[0]?.em_aberto || 0) });
}

export async function conferenciaDiaria(req: Request, res: Response) {
  const { data, operador_id, cliente_id } = req.query as any;
  const where: string[] = ["CAST(created_at AS DATE) = @dt"];
  const r = new sql.Request(pool).input("dt", sql.Date, data ?? new Date());

  if (operador_id) { where.push("created_by = @op"); r.input("op", sql.Int, Number(operador_id)); }
  if (cliente_id)  { where.push("cliente_id = @cli"); r.input("cli", sql.Int, Number(cliente_id)); }

  const rs = await r.query(`
    SELECT *
    FROM dbo.financeiro_titulos
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC;
  `);

  const resumo: Record<string, number> = {};
  for (const t of rs.recordset) resumo[t.tipo] = (resumo[t.tipo] ?? 0) + Number(t.valor_bruto);

  res.json({ data: data ?? new Date(), total: rs.recordset.length, resumo, titulos: rs.recordset });
}
// Detalhar um título por ID
export async function getTitulo(req: Request, res: Response) {
  const { id } = req.params as any;

  const rs = await new sql.Request(pool)
    .input("id", sql.Int, Number(id))
    .query(`
      SELECT *
      FROM dbo.financeiro_titulos
      WHERE id = @id
    `);

  const row = rs.recordset[0];
  if (!row) return res.status(404).json({ message: "Título não encontrado" });
  res.json(row);
}

// “Excluir” título: soft delete marcando como CANCELADO
// (evita quebrar histórico/baixas). Se preferir delete físico, avisa que mando.
export async function deleteTitulo(req: Request, res: Response) {
  const { id } = req.params as any;

  const rs = await new sql.Request(pool)
    .input("id", sql.Int, Number(id))
    .query(`
      UPDATE dbo.financeiro_titulos
         SET status = 'CANCELADO',
             updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE id = @id
    `);

  const row = rs.recordset[0];
  if (!row) return res.status(404).json({ message: "Título não encontrado" });
  res.json(row);
}
