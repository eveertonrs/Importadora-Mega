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
        const { data } = await api.get("/clientes", { params: { search: debounced } });
        if (cancelled) return;
        const list: Cliente[] = (data?.data ?? data ?? []).slice(0, 10);
        setCliOpts(list);
        setCliOpen(true);
      } catch {
        // silencia auto-complete
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
      r.valor.toString().replace(".", ","),
      r.forma_pagamento,
      new Date(r.criado_em).toLocaleString(),
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

  const total = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.valor || 0), 0),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1" ref={cliBoxRef}>
          <label className="text-sm block mb-1">Cliente</label>
          <div className="relative">
            <input
              className="border rounded px-3 py-2 w-full pr-20"
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
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                onClick={clearCliente}
                title="Limpar"
              >
                Limpar
              </button>
            )}

            {cliOpen && cliOpts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
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
              Filtrando por cliente: <b>#{clienteId}</b>
            </div>
          )}
        </div>

        <button
          onClick={load}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Carregando…" : "Filtrar"}
        </button>

        <button
          onClick={exportCsv}
          className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          disabled={rows.length === 0}
          title="Exportar CSV"
        >
          Exportar
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">#</th>
              <th className="p-2 border">Cliente</th>
              <th className="p-2 border">Valor</th>
              <th className="p-2 border">Forma</th>
              <th className="p-2 border">Data</th>
              <th className="p-2 border">Obs</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center">
                  Carregando…
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-2 border w-16 text-center">{r.id}</td>
                  <td className="p-2 border">
                    {r.cliente_nome ?? `#${r.cliente_id}`}
                  </td>
                  <td className="p-2 border whitespace-nowrap">
                    {Number(r.valor).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="p-2 border">{r.forma_pagamento}</td>
                  <td className="p-2 border">
                    {new Date(r.criado_em).toLocaleString()}
                  </td>
                  <td className="p-2 border">{r.observacao ?? "-"}</td>
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  Sem registros
                </td>
              </tr>
            )}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td className="p-2 border font-medium text-right" colSpan={2}>
                  Total:
                </td>
                <td className="p-2 border font-semibold">
                  {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="p-2 border" colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
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
