// src/components/HistoricoPagamentos.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { ensureClientNames, getClientName } from "../utils/clientNameCache";

/* ==================== ÍCONES INLINE ==================== */
function IconSearch({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconDownload({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
    </svg>
  );
}
function IconRefresh({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

/* ==================== Tipos ==================== */
type RowAPI = {
  id: number;
  cliente_id: number;
  valor: number;                   // backend pode mandar sempre positivo
  forma_pagamento: string;
  criado_em: string;               // ISO
  observacao?: string | null;
  cliente_nome?: string | null;

  // 🔽 mesmos campos usados no BlocoDetalhe
  criado_por?: number | null;
  criado_por_nome?: string | null;

  // às vezes o backend já manda o sentido:
  tipo?: string | null;            // "ENTRADA" | "SAIDA"
  natureza?: string | null;        // "ENTRADA" | "SAIDA" | "E" | "S"
  movimento?: string | null;       // idem
};

type Row = RowAPI & {
  /** Convenção do sistema:
   *  SAÍDA = +valor   |   ENTRADA = −valor
   */
  valor_assinado: number;
  direcao: "ENTRADA" | "SAIDA";
};

type Cliente = { id: number; nome_fantasia: string };

/* ==================== Helpers ==================== */
const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dtBR = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const initials = (name?: string | null) =>
  (name || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");

const formaTone = (f: string) => {
  const s = (f || "").toUpperCase();
  if (s.includes("PIX") || s.includes("DINHEIRO")) return "emerald";
  if (s.includes("BOLETO")) return "indigo";
  if (s.includes("CHEQUE")) return "sky";
  if (s.includes("ESTORNO") || s.includes("DEVOL") || s.includes("TROCO")) return "rose";
  if (s.includes("SALDO")) return "slate";
  if (s.includes("PEDIDO")) return "amber";
  return "amber";
};

function Badge({ tone, children }: { tone: "emerald" | "indigo" | "sky" | "slate" | "amber" | "rose"; children: React.ReactNode }) {
  const cls =
    tone === "emerald" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : tone === "indigo" ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
    : tone === "sky" ? "bg-sky-50 text-sky-700 ring-sky-200"
    : tone === "rose" ? "bg-rose-50 text-rose-700 ring-rose-200"
    : tone === "amber" ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-slate-50 text-slate-700 ring-slate-200";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>{children}</span>;
}

function useDebounce<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/* ==================== Normalização (ENTRADA = − | SAÍDA = +) ==================== */

function isSaidaByObs(obs?: string | null) {
  const s = (obs || "").toUpperCase();
  return s.includes("BAIXA") || s.includes("ESTORNO") || s.includes("DEVOLU");
}

function isSaidaByForma(forma?: string | null) {
  const f = (forma || "").toUpperCase();
  return f.includes("ESTORNO") || f.includes("TROCO");
}

function isEntradaByForma(forma?: string | null) {
  const f = (forma || "").toUpperCase();
  return (
    f.includes("SALDO") ||
    f.includes("PEDIDO") ||
    f.includes("PIX") ||
    f.includes("BOLETO") ||
    f.includes("CHEQUE") ||
    f.includes("DEPOS") ||
    f.includes("DINHEIRO") ||
    f.includes("CART")
  );
}

/** Aplica a convenção do sistema:
 *  SAÍDA = +valor   |   ENTRADA = −valor
 */
function normalizeRow(r: RowAPI): Row {
  const abs = Math.abs(Number(r.valor) || 0);

  // 1) campos explícitos do backend têm prioridade
  const t = (r.tipo || r.natureza || r.movimento || "").toString().toUpperCase();
  if (t === "SAIDA" || t === "S") return { ...r, direcao: "SAIDA", valor_assinado: +abs };
  if (t === "ENTRADA" || t === "E") return { ...r, direcao: "ENTRADA", valor_assinado: -abs };

  // 2) heurística por observação/forma
  const saidaObs = isSaidaByObs(r.observacao);
  const saidaForma = isSaidaByForma(r.forma_pagamento);
  const entradaForma = isEntradaByForma(r.forma_pagamento);

  if (saidaObs || saidaForma) return { ...r, direcao: "SAIDA", valor_assinado: +abs };
  if (entradaForma) return { ...r, direcao: "ENTRADA", valor_assinado: -abs };

  // 3) fallback seguro: considerar ENTRADA (−)
  return { ...r, direcao: "ENTRADA", valor_assinado: -abs };
}

/* ==================== Componente ==================== */
export default function HistoricoPagamentos() {
  // dados crus (normalizados) e dados filtrados para exibir
  const [sourceRows, setSourceRows] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cliente (autocomplete)
  const [clienteInput, setClienteInput] = useState("");
  const [clienteId, setClienteId] = useState<number | "">("");
  const debounced = useDebounce(clienteInput, 250);
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const [cliOpen, setCliOpen] = useState(false);
  const cliRef = useRef<HTMLDivElement>(null);

  // busca, período, tipo e ordenação
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<"today" | "7d" | "30d" | "month" | "all" | null>(null);
  const [tipoFilter, setTipoFilter] = useState<"ALL" | "ENTRADA" | "SAIDA">("ALL");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "value_desc" | "value_asc">("date_desc");

  useEffect(() => {
    function close(e: MouseEvent) { if (!cliRef.current?.contains(e.target as Node)) setCliOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // autocomplete
  useEffect(() => {
    let active = true;
    (async () => {
      if (debounced.trim().length < 2 || clienteId !== "") { setCliOpts([]); return; }
      try {
        const { data } = await api.get("/clientes", { params: { search: debounced, limit: 10 } });
        if (!active) return;
        const list: Cliente[] = (data?.data ?? data ?? []).slice(0, 10);
        setCliOpts(list); setCliOpen(list.length > 0);
      } catch {}
    })();
    return () => { active = false; };
  }, [debounced, clienteId]);

  function selectCliente(c: Cliente) { setClienteInput(c.nome_fantasia); setClienteId(c.id); setCliOpen(false); }
  function clearCliente() { setClienteInput(""); setClienteId(""); setCliOpts([]); setCliOpen(false); }

  // ---- fetch cru + resolver nomes + normalizar entradas/saídas
  async function reload() {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get("/pagamentos/historico"); // traz tudo
      const listAPI: RowAPI[] = data?.data ?? data ?? [];
      const ids = Array.from(new Set(listAPI.map((r) => Number(r.cliente_id)).filter(Boolean)));
      await ensureClientNames(ids);

      const normalized: Row[] = listAPI.map((r) => {
        const n = normalizeRow(r);
        return { ...n, cliente_nome: getClientName(n.cliente_id, n.cliente_nome) };
      });

      setSourceRows(normalized);
      applyFilters(normalized); // aplica filtros atuais
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha ao carregar histórico.");
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []); // primeira carga

  // ---- aplica filtros no front (inclusivo por dia)
  function applyFilters(base: Row[] = sourceRows, opts?: Partial<{
    from: string; to: string; clienteId: number | ""; q: string; tipo: "ALL"|"ENTRADA"|"SAIDA"; sort: typeof sort;
  }>) {
    const f = (opts?.from ?? from) || "";
    const t = (opts?.to ?? to) || "";
    const cid = opts?.clienteId ?? clienteId;
    const qq = (opts?.q ?? q).trim().toLowerCase();
    const tipo = opts?.tipo ?? tipoFilter;
    const ord  = opts?.sort ?? sort;

    const fromTS = f ? new Date(`${f}T00:00:00`).getTime() : -Infinity;
    const toTS   = t ? new Date(`${t}T23:59:59.999`).getTime() : Infinity;

    let filtered = base.filter((r) => {
      const ts = new Date(r.criado_em).getTime();
      if (ts < fromTS || ts > toTS) return false;
      if (cid !== "" && Number(r.cliente_id) !== Number(cid)) return false;
      if (tipo !== "ALL" && r.direcao !== tipo) return false;
      if (qq) {
        const hay = (
          ((r.observacao || "") + " " + (r.forma_pagamento || "") + " " + (r.criado_por_nome || "") + " " + String(r.criado_por ?? ""))
        ).toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });

    // ordenação
    filtered.sort((a, b) => {
      if (ord === "date_desc") return +new Date(b.criado_em) - +new Date(a.criado_em);
      if (ord === "date_asc")  return +new Date(a.criado_em) - +new Date(b.criado_em);
      if (ord === "value_desc") return Math.abs(b.valor_assinado) - Math.abs(a.valor_assinado);
      return Math.abs(a.valor_assinado) - Math.abs(b.valor_assinado);
    });

    setRows(filtered);
  }

  // chips de período (auto-aplica + destaque)
  function quickRange(kind: "today" | "7d" | "30d" | "month" | "all") {
    setRange(kind);
    const now = new Date();
    if (kind === "today") {
      const iso = now.toISOString().slice(0, 10);
      setFrom(iso); setTo(iso);
      applyFilters(sourceRows, { from: iso, to: iso });
    } else if (kind === "7d") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      const f = d.toISOString().slice(0, 10), t = now.toISOString().slice(0, 10);
      setFrom(f); setTo(t); applyFilters(sourceRows, { from: f, to: t });
    } else if (kind === "30d") {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      const f = d.toISOString().slice(0, 10), t = now.toISOString().slice(0, 10);
      setFrom(f); setTo(t); applyFilters(sourceRows, { from: f, to: t });
    } else if (kind === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const f = first.toISOString().slice(0, 10), t = last.toISOString().slice(0, 10);
      setFrom(f); setTo(t); applyFilters(sourceRows, { from: f, to: t });
    } else {
      setFrom(""); setTo(""); applyFilters(sourceRows, { from: "", to: "" });
    }
  }

  // alterações manuais limpam chip ativo (usa botão Filtrar)
  function onChangeFrom(v: string) { setFrom(v); setRange(null); }
  function onChangeTo(v: string) { setTo(v); setRange(null); }

  /* ===== métricas (com a convenção ENTRADA=− / SAÍDA=+) ===== */
  function sumTotals(list: Row[]) {
    const entradas = list.filter(r => r.direcao === "ENTRADA").reduce((a, r) => a + Math.abs(r.valor_assinado), 0);
    const saidas   = list.filter(r => r.direcao === "SAIDA").reduce((a, r) => a + Math.abs(r.valor_assinado), 0);
    return { entradas, saidas };
  }

  const stats = useMemo(() => {
    const { entradas, saidas } = sumTotals(rows);
    return {
      count: rows.length,
      totalEntradas: entradas,
      totalSaidas: saidas,
    };
  }, [rows]);

  const saldo = stats.totalEntradas - stats.totalSaidas; // saldo do recorte (Entradas − Saídas)

  // saldo inicial (antes do período) e final (inicial + movimento)
  const saldoInicial = useMemo(() => {
    if (!from) return 0;
    const ts = new Date(`${from}T00:00:00`).getTime();
    const prev = sourceRows.filter(r => +new Date(r.criado_em) < ts);
    const { entradas, saidas } = sumTotals(prev);
    return entradas - saidas;
  }, [from, sourceRows]);

  const saldoFinal = saldoInicial + saldo;

  // resumo por forma (do que está filtrado)
  const resumoPorForma = useMemo(() => {
    const map = new Map<string, { entradas: number; saidas: number; count: number }>();
    for (const r of rows) {
      const key = (r.forma_pagamento || "—").toUpperCase();
      if (!map.has(key)) map.set(key, { entradas: 0, saidas: 0, count: 0 });
      const obj = map.get(key)!;
      obj.count += 1;
      if (r.direcao === "ENTRADA") obj.entradas += Math.abs(r.valor_assinado);
      else obj.saidas += Math.abs(r.valor_assinado);
    }
    return Array.from(map.entries()).sort(
      (a, b) => (b[1].entradas + b[1].saidas) - (a[1].entradas + a[1].saidas)
    ).slice(0, 8);
  }, [rows]);

  // exporta o que está na tela (filtrado) — mantém o sinal do sistema
  function exportCsv() {
    const header = ["cliente", "direcao", "valor", "forma", "por", "data", "observacao"];
    const lines = rows.map((r) => [
      getClientName(r.cliente_id, r.cliente_nome),
      r.direcao,
      String(r.valor_assinado).replace(".", ","), // ENTRADA negativa, SAÍDA positiva
      r.forma_pagamento,
      (r.criado_por_nome?.trim() || (r.criado_por ? `#${r.criado_por}` : "")),
      dtBR(r.criado_em),
      (r.observacao ?? "").replaceAll('"', '""'),
    ]);
    const csv = header.join(";") + "\n" + lines.map((l) => l.map((v) => `"${String(v)}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "historico_pagamentos.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header escuro */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-white">
            <h1 className="text-2xl font-semibold tracking-tight">Histórico de pagamentos</h1>
            <p className="text-slate-300 text-sm">Saídas <b>(+ verde)</b>, Entradas <b>(− vermelho)</b>, filtros e exportação.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reload}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20">
              <IconRefresh /> Recarregar
            </button>
            <button onClick={exportCsv} disabled={rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2 text-white hover:bg-emerald-600 disabled:opacity-50">
              <IconDownload /> Exportar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardDark title="Lançamentos" value={String(stats.count)} />
          <StatCardDark title="Entradas (−)" value={money(stats.totalEntradas)} tone="rose" />
          <StatCardDark title="Saídas (+)" value={money(stats.totalSaidas)} tone="emerald" />
          <StatCardDark title="Saldo (Entradas − Saídas)" value={money(saldo)} tone={saldo >= 0 ? "emerald" : "rose"} />
        </div>

        {(from || to) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-[12px] text-slate-200">
            <div className="rounded-xl bg-white/5 px-3 py-2">Saldo inicial do período: <b>{money(saldoInicial)}</b></div>
            <div className="rounded-xl bg-white/5 px-3 py-2">Movimento no período: <b>{money(saldo)}</b></div>
            <div className="rounded-xl bg-white/5 px-3 py-2">Saldo final (estimado): <b>{money(saldoFinal)}</b></div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {/* Linha 1: Cliente + busca */}
        <div className="grid gap-3 md:grid-cols-2">
          <div ref={cliRef}>
            <label className="text-xs font-medium text-slate-600">Cliente</label>
            <div className="relative">
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 pr-24"
                placeholder="Digite para buscar pelo nome…"
                value={clienteInput}
                onChange={(e) => { setClienteInput(e.target.value); if (clienteId !== "") setClienteId(""); }}
                onFocus={() => cliOpts.length && setCliOpen(true)}
              />
              {(clienteInput || clienteId !== "") && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50" onClick={clearCliente}>Limpar</button>
                  <button className="rounded border bg-white px-2 py-1 text-xs hover:bg-slate-50" onClick={() => { clearCliente(); applyFilters(); }}>
                    Todos
                  </button>
                </div>
              )}
              {cliOpen && cliOpts.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg">
                  {cliOpts.map((c) => (
                    <button key={c.id} className="block w-full px-3 py-2 text-left hover:bg-slate-50" type="button"
                      onClick={() => { selectCliente(c); applyFilters(sourceRows, { clienteId: c.id }); }}>
                      {c.nome_fantasia}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clienteId !== "" && <div className="mt-1 text-xs text-slate-600">Filtrando por: <b>#{clienteId}</b></div>}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Busca rápida</label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="mt-1 w-full rounded-xl border px-8 py-2"
                placeholder="observação, forma, usuário…"
                value={q}
                onChange={(e) => { setQ(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
              />
            </div>
          </div>
        </div>

        {/* Linha 2: Datas, tipo e ordenação */}
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-slate-600">De</label>
            <input type="date" className="mt-1 w-full rounded-xl border px-4 py-2" value={from} onChange={(e) => onChangeFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Até</label>
            <input type="date" className="mt-1 w-full rounded-xl border px-4 py-2" value={to} onChange={(e) => onChangeTo(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Tipo</label>
            <div className="mt-1 flex rounded-xl border p-1 text-xs">
              {(["ALL","ENTRADA","SAIDA"] as const).map((k) => (
                <button key={k}
                  className={`flex-1 rounded-lg px-3 py-1 ${tipoFilter===k ? "bg-slate-900 text-white" : "hover:bg-slate-50"}`}
                  onClick={() => { setTipoFilter(k); applyFilters(sourceRows, { tipo: k }); }}>
                  {k === "ALL" ? "Todos" : k === "ENTRADA" ? "Entradas (−)" : "Saídas (+)"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Ordenar por</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => { const v = e.target.value as typeof sort; setSort(v); applyFilters(sourceRows, { sort: v }); }}
            >
              <option value="date_desc">Data (recente → antigo)</option>
              <option value="date_asc">Data (antigo → recente)</option>
              <option value="value_desc">Valor (maior → menor)</option>
              <option value="value_asc">Valor (menor → maior)</option>
            </select>
          </div>
        </div>

        {/* Linha 3: Chips de período e botão Filtrar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[
            { k: "today", label: "Hoje" },
            { k: "7d", label: "Últimos 7d" },
            { k: "30d", label: "Últimos 30d" },
            { k: "month", label: "Este mês" },
            { k: "all", label: "Tudo" },
          ].map((b) => {
            const active = range === (b.k as any);
            return (
              <button key={b.k} onClick={() => quickRange(b.k as any)}
                className={[
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  active ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                         : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}>
                {b.label}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-3">
            <div className="text-xs text-slate-500">{rows.length} resultado(s)</div>
            <button onClick={() => applyFilters()} className="rounded-xl bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50" disabled={loading}>
              {loading ? "Carregando…" : "Filtrar"}
            </button>
          </div>
        </div>
      </div>

      {/* Resumo por forma */}
      {rows.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-slate-700">Resumo por forma (visão atual)</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {resumoPorForma.map(([forma, v]) => (
              <div key={forma} className="rounded-xl border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge tone={formaTone(forma)}>{forma}</Badge>
                  <span className="text-[11px] text-slate-500">{v.count} reg.</span>
                </div>
                <div className="text-xs text-slate-600">
                  Entradas: <b className="text-rose-700">- {money(v.entradas)}</b>
                </div>
                <div className="text-xs text-slate-600">
                  Saídas: <b className="text-emerald-700">+ {money(v.saidas)}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
        {error && <div className="border-b bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left">
              <th className="border p-2">Cliente</th>
              <th className="border p-2">Direção</th>
              <th className="border p-2">Valor</th>
              <th className="border p-2">Forma</th>
              <th className="border p-2">Por</th> {/* 👈 novo */}
              <th className="border p-2">Data</th>
              <th className="border p-2">Obs</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-slate-50/40">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="border p-2"><div className="h-4 w-full max-w-[180px] rounded bg-slate-100" /></td>
                  ))}
                </tr>
              ))}

            {!loading &&
              rows.map((r) => {
                const nome = getClientName(r.cliente_id, r.cliente_nome);
                const isSaida = r.direcao === "SAIDA";
                const sign = isSaida ? "+" : "−";
                const autor = r.criado_por_nome?.trim() || (r.criado_por ? `#${r.criado_por}` : "—");
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="border p-2">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-100 to-white text-xs font-medium ring-1 ring-slate-200">
                          {initials(nome)}
                        </div>
                        <div className="truncate font-medium">{nome || "—"}</div>
                      </div>
                    </td>
                    <td className="border p-2 whitespace-nowrap">
                      {isSaida ? <Badge tone="emerald">SAÍDA (+)</Badge> : <Badge tone="rose">ENTRADA (−)</Badge>}
                    </td>
                    <td className={`border p-2 font-semibold whitespace-nowrap ${isSaida ? "text-emerald-700" : "text-rose-700"}`}>
                      {sign} {money(Math.abs(r.valor_assinado))}
                    </td>
                    <td className="border p-2"><Badge tone={formaTone(r.forma_pagamento)}>{r.forma_pagamento}</Badge></td>
                    <td className="border p-2 whitespace-nowrap">{autor}</td> {/* 👈 novo */}
                    <td className="border p-2 whitespace-nowrap">{dtBR(r.criado_em)}</td>
                    <td className="border p-2">
                      {r.observacao ? <span className="line-clamp-2" title={r.observacao ?? ""}>{r.observacao}</span> : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}

            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-slate-500">Nenhum lançamento encontrado.</td></tr>
            )}
          </tbody>

          {!loading && rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100/60">
                <td className="border p-2 text-right font-medium" colSpan={2}>
                  Totais ({rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}):
                </td>
                <td className={`border p-2 font-semibold ${saldo >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {saldo >= 0 ? "+" : "−"} {money(Math.abs(saldo))}
                </td>
                <td className="border p-2" colSpan={4}></td> {/* ajustado por nova coluna */}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ==================== Visuais ==================== */
function StatCardDark({
  title,
  value,
  tone = "slate",
}: { title: string; value: string; tone?: "slate" | "emerald" | "rose"; }) {
  const tones: Record<string, string> = {
    slate: "bg-white/5 ring-white/10",
    emerald: "bg-emerald-400/10 ring-emerald-300/20",
    rose: "bg-rose-400/10 ring-rose-300/20",
  };
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-medium text-slate-300">{title}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}
