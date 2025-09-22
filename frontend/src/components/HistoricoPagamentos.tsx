// src/components/HistoricoPagamentos.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

type Row = {
  id: number;
  cliente_id: number;
  valor: number;
  forma_pagamento: string;
  criado_em: string;
  observacao?: string | null;
  cliente_nome?: string | null;
};

type Cliente = { id: number; nome_fantasia: string };

/* ------------ pequenos helpers de UI ------------ */
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

const Badge = ({ tone, children }: { tone?: "blue" | "green" | "amber" | "slate"; children: React.ReactNode }) => {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700 ring-1 ring-slate-200"
      : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
};

const formaTone = (f: string): "blue" | "green" | "amber" | "slate" => {
  const s = f.toUpperCase();
  if (s.includes("PIX")) return "green";
  if (s.includes("BOLETO")) return "blue";
  if (s.includes("DEVOL") || s.includes("ESTORNO")) return "amber";
  return "slate";
};

export default function HistoricoPagamentos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // === filtro por cliente (com auto-complete) ===
  const [clienteInput, setClienteInput] = useState("");
  const [clienteId, setClienteId] = useState<number | "">("");
  const [cliOpen, setCliOpen] = useState(false);
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const cliBoxRef = useRef<HTMLDivElement>(null);

  // debounce do texto digitado
  const debounced = useDebounce(clienteInput, 250);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!cliBoxRef.current?.contains(e.target as Node)) setCliOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    // só busca quando tiver 2+ chars e não tiver um cliente selecionado
    if (debounced.trim().length < 2 || clienteId !== "") {
      setCliOpts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/clientes", { params: { search: debounced, limit: 10 } });
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

  // === carregar histórico ===
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/pagamentos/historico", {
        params: { cliente_id: clienteId === "" ? undefined : Number(clienteId) },
      });
      setRows(data?.data ?? data ?? []);
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

  // export CSV simples
  function exportCsv() {
    const header = ["id", "cliente", "valor", "forma", "data", "observacao"];
    const lines = rows.map((r) => [
      r.id,
      r.cliente_nome ?? r.cliente_id,
      String(r.valor).replace(".", ","),
      r.forma_pagamento,
      formatDateTime(r.criado_em),
      (r.observacao ?? "").replaceAll('"', '""'),
    ]);
    const csv =
      header.join(";") +
      "\n" +
      lines.map((l) => l.map((v) => `"${String(v)}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico_pagamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = useMemo(() => rows.reduce((acc, r) => acc + Number(r.valor || 0), 0), [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-semibold">Histórico de pagamentos</h1>
        <p className="text-sm text-slate-500">
          Consulte lançamentos por cliente e exporte para CSV.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {/* Barra de filtros */}
        <div className="flex flex-wrap items-end gap-2 p-4 border-b">
          <div className="min-w-[260px] flex-1" ref={cliBoxRef}>
            <label className="text-sm block mb-1 text-slate-700">Cliente</label>
            <div className="relative">
              <input
                className="border rounded px-3 py-2 w-full pr-28 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                      <div className="text-xs text-slate-500">#{c.id}</div>
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
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Carregando…" : "Filtrar"}
          </button>

          <button
            onClick={exportCsv}
            className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            disabled={rows.length === 0}
            title="Exportar CSV"
          >
            Exportar
          </button>
        </div>

        {/* Mensagens */}
        {(error) && (
          <div className="p-4 border-b">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="p-2 border w-16 text-center">#</th>
                <th className="p-2 border">Cliente</th>
                <th className="p-2 border w-40">Valor</th>
                <th className="p-2 border w-36">Forma</th>
                <th className="p-2 border w-44">Data</th>
                <th className="p-2 border">Obs</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-slate-50/40">
              {loading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center">
                    Carregando…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-2 border text-center">{r.id}</td>
                    <td className="p-2 border">{r.cliente_nome ?? `#${r.cliente_id}`}</td>
                    <td className="p-2 border whitespace-nowrap font-medium">{formatBRL(r.valor)}</td>
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
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>

            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/60">
                  <td className="p-2 border font-medium text-right" colSpan={2}>
                    Total ({rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}):
                  </td>
                  <td className="p-2 border font-semibold">{formatBRL(total)}</td>
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

/** Hook de debounce bem simples */
function useDebounce<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
