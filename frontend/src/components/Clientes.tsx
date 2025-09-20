// src/components/Clientes.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

type Cliente = {
  id: number;
  nome_fantasia: string;
  tabela_preco?: string | null;
  status?: "ATIVO" | "INATIVO";
  whatsapp?: string | null;
};

export default function Clientes() {
  const nav = useNavigate();

  // filtros
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ATIVO" | "INATIVO">("");

  // dados/estado
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // debounce simples (400ms)
  const debounceMs = 400;
  const timerRef = useRef<number | null>(null);
  const debounced = useMemo(() => search.trim(), [search]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get("/clientes", {
        params: {
          search: debounced || undefined,
          status: status || undefined,
        },
      });
      setRows(data?.data ?? data ?? []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Falha ao carregar clientes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // dispara busca com debounce quando search/status mudarem
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(load, debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, status]);

  return (
    <div className="space-y-4">
      {/* Header / Ações */}
      <div className="flex flex-wrap items-end gap-2 justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-slate-500">Gerencie cadastro e acesso rápido aos blocos.</p>
        </div>
        <button
          onClick={() => nav("/clientes/novo")}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Novo cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-white p-3 md:p-4 shadow-sm">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Buscar</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nome, WhatsApp…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Status</label>
            <select
              className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={status}
              onChange={(e) => setStatus((e.target.value as any) || "")}
            >
              <option value="">(todos)</option>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="p-2 border">#</th>
              <th className="p-2 border">Nome fantasia</th>
              <th className="p-2 border">Tabela</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <>
                {[...Array(4)].map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td className="p-2 border">
                      <div className="h-4 w-8 bg-slate-100 animate-pulse rounded" />
                    </td>
                    <td className="p-2 border">
                      <div className="h-4 w-48 bg-slate-100 animate-pulse rounded" />
                    </td>
                    <td className="p-2 border">
                      <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                    </td>
                    <td className="p-2 border">
                      <div className="h-5 w-20 bg-slate-100 animate-pulse rounded" />
                    </td>
                    <td className="p-2 border">
                      <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center">
                  {err ? (
                    <div className="text-red-700">{err}</div>
                  ) : (
                    <div className="text-slate-500">
                      Nada encontrado. Ajuste a busca ou{" "}
                      <button
                        onClick={() => nav("/clientes/novo")}
                        className="text-blue-700 underline"
                      >
                        crie um cliente
                      </button>
                      .
                    </div>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="p-2 border align-top">{c.id}</td>
                  <td className="p-2 border align-top">
                    <div className="font-medium">{c.nome_fantasia}</div>
                    {c.whatsapp && (
                      <div className="text-xs text-slate-500">{c.whatsapp}</div>
                    )}
                  </td>
                  <td className="p-2 border align-top">{c.tabela_preco ?? "-"}</td>
                  <td className="p-2 border align-top">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        c.status === "INATIVO"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200",
                      ].join(" ")}
                    >
                      {c.status ?? "-"}
                    </span>
                  </td>
                  <td className="p-2 border align-top">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/clientes/${c.id}`} className="text-blue-700 underline">
                        Abrir
                      </Link>
                      <Link
                        to={`/blocos?cliente=${c.id}`}
                        className="text-emerald-700 underline"
                      >
                        Blocos
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
