import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { ensureClientNames, getClientName } from "../utils/clientNameCache";

type Row = {
  id: number;
  cliente_id: number;
  valor: number;                    // positivo = entrada, negativo = saída
  forma_pagamento: string;
  criado_em: string;                 // ISO
  observacao?: string | null;
  cliente_nome?: string | null;      // <- preferir este no render
};

type Cliente = { id: number; nome_fantasia: string };

/* ================= helpers ================= */
const formatBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const Badge = ({
  tone,
  children,
}: {
  tone?: "blue" | "green" | "amber" | "slate";
  children: React.ReactNode;
}) => {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
      : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
};

const formaTone = (f: string): "blue" | "green" | "amber" | "slate" => {
  const s = (f || "").toUpperCase();
  if (s.includes("PIX")) return "green";
  if (s.includes("BOLETO")) return "blue";
  if (s.includes("DEVOL") || s.includes("ESTORNO") || s.includes("SAIDA")) return "amber";
  return "slate";
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/* ================= componente ================= */
export default function HistoricoPagamentos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filtro por cliente com autocomplete
  const [clienteInput, setClienteInput] = useState("");
  const [clienteId, setClienteId] = useState<number | "">("");
  const [cliOpen, setCliOpen] = useState(false);
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const cliBoxRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(clienteInput, 250);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!cliBoxRef.current?.contains(e.target as Node)) setCliOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounced.trim().length < 2 || clienteId !== "") {
      setCliOpts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/clientes", {
          params: { search: debounced, limit: 10 },
        });
        if (cancelled) return;
        const list: Cliente[] = (data?.data ?? data ?? []).slice(0, 10);
        setCliOpts(list);
        setCliOpen(list.length > 0);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, clienteId]);

  function selectCliente(c: Cliente) {
    setClienteInput(c.nome_fantasia);
    setClienteId(c.id);
    setCliOpen(false);
  }
  function clearCliente() {
    setClienteInput("");
    setClienteId("");
    setCliOpts([]);
    setCliOpen(false);
  }

  // carregar histórico + resolver nomes
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/pagamentos/historico", {
        params: { cliente_id: clienteId === "" ? undefined : Number(clienteId) },
      });
      const list: Row[] = data?.data ?? data ?? [];

      // garantir nomes no cache e injetar no array
      const ids = Array.from(new Set(list.map((r) => Number(r.cliente_id)).filter(Boolean)));
      await ensureClientNames(ids);

      setRows(
        list.map((r) => ({
          ...r,
          cliente_nome: getClientName(r.cliente_id, r.cliente_nome),
        }))
      );
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======== agregações p/ dashboard ========
  const stats = useMemo(() => {
    const entradas = rows.filter((r) => Number(r.valor) > 0);
    const saidas = rows.filter((r) => Number(r.valor) < 0);
    const somaEntradas = entradas.reduce((a, r) => a + Number(r.valor), 0);
    const somaSaidas = Math.abs(saidas.reduce((a, r) => a + Number(r.valor), 0));
    const saldo = somaEntradas - somaSaidas;

    // por forma
    const porForma = new Map<string, { total: number; count: number }>();
    rows.forEach((r) => {
      const key = (r.forma_pagamento || "—").toUpperCase();
      const prev = porForma.get(key) || { total: 0, count: 0 };
      porForma.set(key, { total: prev.total + Number(r.valor || 0), count: prev.count + 1 });
    });

    // últimos 6 meses (soma por mês)
    const today = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const k = monthKey(d);
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).toUpperCase();
      months.push({ key: k, label, total: 0 });
    }
    rows.forEach((r) => {
      const d = new Date(r.criado_em);
      const k = monthKey(d);
      const m = months.find((x) => x.key === k);
      if (m) m.total += Number(r.valor || 0);
    });
    const maxAbs = Math.max(1, ...months.map((m) => Math.abs(m.total)));

    return {
      entradas: somaEntradas,
      saidas: somaSaidas,
      saldo,
      totalLancamentos: rows.length,
      porForma: Array.from(porForma.entries())
        .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
        .slice(0, 6),
      meses: months,
      maxAbs,
    };
  }, [rows]);

  // export CSV (usa getClientName para garantir nome)
  function exportCsv() {
    const header = ["cliente", "valor", "forma", "data", "observacao"];
    const lines = rows.map((r) => [
      getClientName(r.cliente_id, r.cliente_nome),
      String(r.valor).replace(".", ","),
      r.forma_pagamento,
      formatDateTime(r.criado_em),
      (r.observacao ?? "").replaceAll('"', '""'),
    ]);
    const csv = header.join(";") + "\n" + lines.map((l) => l.map((v) => `"${String(v)}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico_pagamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* título */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico de pagamentos</h1>
        <p className="text-sm text-slate-500">
          Consulte lançamentos, filtre por cliente e exporte os dados.
        </p>
      </div>

      {/* dashboard */}
      <div className="grid gap-3 md:grid-cols-4">
        <CardStat title="Lançamentos" value={String(stats.totalLancamentos)} />
        <CardStat title="Entradas" value={formatBRL(stats.entradas)} tone="green" />
        <CardStat title="Saídas" value={formatBRL(stats.saidas)} tone="amber" />
        <CardStat title="Saldo" value={formatBRL(stats.saldo)} tone={stats.saldo >= 0 ? "green" : "amber"} />
      </div>

      {/* resumo por forma + mini gráfico */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-medium text-slate-700">Top formas</div>
          <div className="flex flex-wrap gap-2">
            {stats.porForma.length === 0 && <span className="text-slate-400 text-sm">—</span>}
            {stats.porForma.map(([forma, info]) => (
              <Badge key={forma} tone={formaTone(forma)}>
                {forma} • {info.count} • {formatBRL(info.total)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-medium text-slate-700">Últimos 6 meses (saldo por mês)</div>
          <div className="flex h-28 items-end gap-2">
            {stats.meses.map((m) => {
              const h = Math.max(4, Math.round((Math.abs(m.total) / stats.maxAbs) * 96)); // 4..96px
              const pos = m.total >= 0;
              return (
                <div key={m.key} className="flex w-full flex-col items-center gap-1">
                  <div
                    className={[
                      "w-full max-w-8 rounded-t",
                      pos ? "bg-emerald-500/70" : "bg-rose-500/70",
                    ].join(" ")}
                    style={{ height: `${h}px` }}
                    title={`${m.label}: ${formatBRL(m.total)}`}
                  />
                  <div className="text-[11px] text-slate-600">{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* filtro */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-end gap-2 p-4 border-b">
          <div className="min-w-[260px] flex-1" ref={cliBoxRef}>
            <label className="text-sm block mb-1 text-slate-700">Cliente</label>
            <div className="relative">
              <input
                className="border rounded-xl px-3 py-2 w-full pr-28 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Digite para buscar pelo nome…"
                value={clienteInput}
                onChange={(e) => {
                  setClienteInput(e.target.value);
                  if (clienteId !== "") setClienteId("");
                }}
                onFocus={() => {
                  if (cliOpts.length > 0) setCliOpen(true);
                }}
              />
              {(clienteId !== "" || clienteInput) && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                    onClick={clearCliente}
                    title="Limpar"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                    onClick={() => {
                      clearCliente();
                      load();
                    }}
                    title="Mostrar todos"
                  >
                    Todos
                  </button>
                </div>
              )}
              {cliOpen && cliOpts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-64 overflow-auto">
                  {cliOpts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                      onClick={() => selectCliente(c)}
                    >
                      <div className="font-medium">{c.nome_fantasia}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clienteId !== "" && (
              <div className="mt-1 text-xs text-slate-600">
                Filtrando por: <b>#{clienteId}</b>
              </div>
            )}
          </div>

          <button
            onClick={load}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Carregando…" : "Filtrar"}
          </button>

          <button
            onClick={exportCsv}
            className="px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
            disabled={rows.length === 0}
            title="Exportar CSV"
          >
            Exportar
          </button>
        </div>

        {/* tabela */}
        {error && (
          <div className="p-4 border-b">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          </div>
        )}

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                {/* ID removido */}
                <th className="p-2 border">Cliente</th>
                <th className="p-2 border w-40">Valor</th>
                <th className="p-2 border w-40">Forma</th>
                <th className="p-2 border w-44">Data</th>
                <th className="p-2 border">Obs</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50/40">
              {loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    Carregando…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => {
                  const entrada = Number(r.valor) >= 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-2 border">
                        {getClientName(r.cliente_id, r.cliente_nome) ? (
                          <span className="font-medium">{getClientName(r.cliente_id, r.cliente_nome)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`p-2 border whitespace-nowrap font-medium ${entrada ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatBRL(r.valor)}
                      </td>
                      <td className="p-2 border">
                        <Badge tone={formaTone(r.forma_pagamento)}>{r.forma_pagamento}</Badge>
                      </td>
                      <td className="p-2 border whitespace-nowrap">{formatDateTime(r.criado_em)}</td>
                      <td className="p-2 border">
                        {r.observacao ? (
                          <span className="line-clamp-2" title={r.observacao ?? ""}>
                            {r.observacao}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>

            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/60">
                  <td className="p-2 border font-medium text-right">
                    Total ({rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}):
                  </td>
                  <td className="p-2 border font-semibold">{formatBRL(rows.reduce((a, r) => a + Number(r.valor || 0), 0))}</td>
                  <td className="p-2 border" colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== componentes visuais ===== */
function CardStat({
  title,
  value,
  tone = "slate",
}: {
  title: string;
  value: string;
  tone?: "slate" | "green" | "amber";
}) {
  const toneCls =
    tone === "green"
      ? "from-emerald-50 to-white ring-emerald-200"
      : tone === "amber"
      ? "from-amber-50 to-white ring-amber-200"
      : "from-slate-50 to-white ring-slate-200";
  return (
    <div className={`rounded-2xl border ring-1 ${toneCls} bg-gradient-to-br p-4 shadow-sm`}>
      <div className="text-xs font-medium text-slate-600">{title}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

/** Hook de debounce simples */
function useDebounce<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
