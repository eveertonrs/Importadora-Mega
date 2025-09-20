// src/components/ui/Blocos.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listarBlocos } from "../../services/blocos.api";
import type { Bloco, BlocoStatus } from "../../services/blocos.api";

/** util: debounce simples */
function useDebounce<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Blocos() {
  // preserva filtros na URL (?q=&status=&page=&limit=)
  const [sp, setSp] = useSearchParams();

  const [clienteNome, setClienteNome] = useState<string>(sp.get("q") ?? "");
  const [status, setStatus] = useState<BlocoStatus | "">(sp.get("status") as BlocoStatus | "" || "");
  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit, setLimit] = useState<number>(Number(sp.get("limit") || 10));
  const [sortBy, setSortBy] = useState<"id" | "codigo" | "cliente" | "status">(
    (sp.get("sortBy") as any) || "id"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    (sp.get("sortDir") as any) || "desc"
  );

  const [rows, setRows] = useState<Bloco[]>([]);
  const [loading, setLoading] = useState(false);
  const [skeleton, setSkeleton] = useState(false);

  const debouncedNome = useDebounce(clienteNome, 400);

  // sincroniza URL
  useEffect(() => {
    const p = new URLSearchParams(sp);
    p.set("q", clienteNome);
    status ? p.set("status", status) : p.delete("status");
    p.set("page", String(page));
    p.set("limit", String(limit));
    p.set("sortBy", sortBy);
    p.set("sortDir", sortDir);
    setSp(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteNome, status, page, limit, sortBy, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    setSkeleton(rows.length === 0);
    try {
      const r = await listarBlocos({
        // backend aceitando estes campos:
        cliente_nome: debouncedNome || undefined,
        status: status || undefined,
        page,
        limit,
        sortBy,  // "id" | "codigo" | "cliente" | "status"
        sortDir, // "asc" | "desc"
      } as any);
      setRows(r.data ?? []);
    } finally {
      setLoading(false);
      setSkeleton(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNome, status, page, limit, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  const th = (key: typeof sortBy, label: string) => (
    <th
      onClick={() => {
        setPage(1);
        setSortBy(key);
        setSortDir((d) => (key === sortBy ? (d === "asc" ? "desc" : "asc") : "asc"));
      }}
      className="p-2 border-b text-left select-none cursor-pointer whitespace-nowrap"
      aria-sort={sortBy === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <span className="ml-1 text-xs opacity-60">{sortBy === key ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
    </th>
  );

  const badge = (s: BlocoStatus) => (
    <span
      className={
        "text-[11px] px-2 py-0.5 rounded-full font-medium " +
        (s === "ABERTO"
          ? "bg-blue-100 text-blue-700"
          : "bg-slate-200 text-slate-700")
      }
      aria-label={`Status ${s}`}
    >
      {s}
    </span>
  );

  const canNext = rows.length >= limit; // simples; se sua API retornar total, troque a lógica

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Blocos</h1>

      {/* filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm mb-1">Cliente</label>
          <input
            type="text"
            className="border rounded px-3 py-2 w-64"
            value={clienteNome}
            onChange={(e) => {
              setPage(1);
              setClienteNome(e.target.value);
            }}
            placeholder="digite o nome..."
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Status</label>
          <select
            className="border rounded px-3 py-2"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus((e.target.value || "") as BlocoStatus | "");
            }}
          >
            <option value="">(todos)</option>
            <option value="ABERTO">ABERTO</option>
            <option value="FECHADO">FECHADO</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Limite</label>
          <select
            className="border rounded px-3 py-2"
            value={limit}
            onChange={(e) => {
              setPage(1);
              setLimit(Number(e.target.value));
            }}
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}/página
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={load}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Carregando..." : "Buscar"}
        </button>
      </div>

      {/* tabela */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {th("id", "#")}
              {th("codigo", "Código")}
              {th("cliente", "Cliente")}
              {th("status", "Status")}
              <th className="p-2 border-b text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {skeleton &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  <td className="p-3 border-b"><div className="h-3 w-6 bg-slate-200 rounded" /></td>
                  <td className="p-3 border-b"><div className="h-3 w-40 bg-slate-200 rounded" /></td>
                  <td className="p-3 border-b"><div className="h-3 w-28 bg-slate-200 rounded" /></td>
                  <td className="p-3 border-b"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                  <td className="p-3 border-b"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                </tr>
              ))}

            {!skeleton &&
              rows.map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => (window.location.href = `/blocos/${b.id}`)}
                >
                  <td className="p-3 border-b">{b.id}</td>
                  <td className="p-3 border-b font-medium">{b.codigo}</td>
                  <td className="p-3 border-b">{b.cliente_nome ?? b.cliente_id}</td>
                  <td className="p-3 border-b">{badge(b.status)}</td>
                  <td className="p-3 border-b">
                    <Link
                      to={`/blocos/${b.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-700 underline"
                    >
                      Detalhe
                    </Link>
                  </td>
                </tr>
              ))}

            {!skeleton && rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <div className="space-y-2">
                    <div className="text-slate-500">Nenhum bloco encontrado</div>
                    <Link
                      to="/blocos"
                      className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Abrir novo bloco
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* paginação */}
      <div className="flex items-center justify-between pt-3">
        <div className="text-sm text-slate-600">
          Página {page} {loading && <span className="opacity-60">• carregando…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded border hover:bg-slate-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Anterior
          </button>
          <button
            className="px-3 py-1.5 rounded border hover:bg-slate-50 disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
            disabled={!canNext || loading}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
