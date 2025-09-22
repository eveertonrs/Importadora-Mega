// src/components/ui/Blocos.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listarBlocos } from "../../services/blocos.api";
import api from "../../services/api";
import type { Bloco, BlocoStatus } from "../../services/blocos.api";

/** debounce simples */
function useDebounce<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Cliente = { id: number; nome_fantasia: string };

export default function Blocos() {
  const [sp, setSp] = useSearchParams();

  // filtros/url
  const [clienteNome, setClienteNome] = useState<string>(sp.get("q") ?? "");
  const [status, setStatus] = useState<BlocoStatus | "">(
    (sp.get("status") as BlocoStatus | "") || ""
  );
  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit, setLimit] = useState<number>(Number(sp.get("limit") || 10));

  // dados
  const [rows, setRows] = useState<Bloco[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [skeleton, setSkeleton] = useState(false);

  // modal novo bloco
  const [openNew, setOpenNew] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteId, setNovoClienteId] = useState<number | "">("");
  const [novaObs, setNovaObs] = useState("");

  // auto-complete no modal
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const [cliOpen, setCliOpen] = useState(false);
  const debouncedBuscaCliente = useDebounce(novoClienteNome, 300);
  const cliBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!cliBoxRef.current?.contains(e.target as Node)) setCliOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debouncedBuscaCliente.trim().length < 2 || novoClienteId !== "") {
      setCliOpts([]);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.get("/clientes", {
          params: { search: debouncedBuscaCliente, limit: 10 },
        });
        if (cancel) return;
        const list: Cliente[] = (data?.data ?? data ?? []).slice(0, 10);
        setCliOpts(list);
        setCliOpen(list.length > 0);
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedBuscaCliente, novoClienteId]);

  function selecionarCliente(c: Cliente) {
    setNovoClienteNome(c.nome_fantasia);
    setNovoClienteId(c.id);
    setCliOpen(false);
  }
  function limparCliente() {
    setNovoClienteNome("");
    setNovoClienteId("");
    setCliOpts([]);
    setCliOpen(false);
  }

  const debouncedNome = useDebounce(clienteNome, 400);

  // sincroniza URL
  useEffect(() => {
    const p = new URLSearchParams(sp);
    p.set("q", clienteNome);
    status ? p.set("status", status) : p.delete("status");
    p.set("page", String(page));
    p.set("limit", String(limit));
    setSp(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteNome, status, page, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    setSkeleton(rows.length === 0);
    try {
      const r = await listarBlocos({
        cliente: debouncedNome || undefined, // backend filtra por nome_fantasia
        status: status || undefined,
        page,
        limit,
      } as any);
      setRows(r.data ?? []);
      setTotal(Number(r.total ?? 0));
    } finally {
      setLoading(false);
      setSkeleton(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNome, status, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const badge = (s: BlocoStatus) => (
    <span
      className={
        "text-[11px] px-2 py-0.5 rounded-full font-medium " +
        (s === "ABERTO" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700")
      }
      aria-label={`Status ${s}`}
    >
      {s}
    </span>
  );

  const canNext = page * limit < total;

  async function handleCriarBloco() {
    if (novoClienteId === "") {
      alert("Selecione um cliente.");
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.post("/blocos", {
        cliente_id: Number(novoClienteId),
        observacao: novaObs || undefined,
      });
      setOpenNew(false);
      limparCliente();
      setNovaObs("");
      window.location.href = `/blocos/${data?.id ?? data?.data?.id}`;
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Falha ao abrir bloco.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Blocos</h1>
        <button
          onClick={() => setOpenNew(true)}
          className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Abrir novo bloco
        </button>
      </div>

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
              <th className="p-2 border-b text-left cursor-default">#</th>
              <th className="p-2 border-b text-left cursor-default">Código</th>
              <th className="p-2 border-b text-left cursor-default">Cliente</th>
              <th className="p-2 border-b text-left cursor-default">Status</th>
              <th className="p-2 border-b text-left cursor-default">Ações</th>
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
                    <button
                      onClick={() => setOpenNew(true)}
                      className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Abrir novo bloco
                    </button>
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

      {/* Modal novo bloco */}
      {openNew && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-md shadow">
            <h2 className="text-lg font-semibold mb-3">Abrir novo bloco</h2>
            <div className="space-y-3" ref={cliBoxRef}>
              <div className="relative">
                <label className="block text-sm mb-1">Cliente</label>
                <input
                  className="border rounded px-3 py-2 w-full pr-24"
                  value={novoClienteNome}
                  onChange={(e) => {
                    setNovoClienteNome(e.target.value);
                    if (novoClienteId !== "") setNovoClienteId("");
                  }}
                  onFocus={() => {
                    if (cliOpts.length > 0) setCliOpen(true);
                  }}
                  placeholder="digite para buscar…"
                />
                {(novoClienteId !== "" || novoClienteNome) && (
                  <button
                    type="button"
                    className="absolute right-2 top-8 text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                    onClick={limparCliente}
                    title="Limpar"
                  >
                    Limpar
                  </button>
                )}
                {cliOpen && cliOpts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-64 overflow-auto">
                    {cliOpts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                        onClick={() => selecionarCliente(c)}
                      >
                        <div className="font-medium">{c.nome_fantasia}</div>
                        <div className="text-xs text-slate-500">#{c.id}</div>
                      </button>
                    ))}
                  </div>
                )}
                {novoClienteId !== "" && (
                  <div className="text-xs text-slate-600 mt-1">
                    Selecionado: <b>#{novoClienteId}</b>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1">Observação</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={novaObs}
                  onChange={(e) => setNovaObs(e.target.value)}
                  placeholder="opcional"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-2 rounded border" onClick={() => setOpenNew(false)}>
                  Cancelar
                </button>
                <button
                  className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                  onClick={handleCriarBloco}
                  disabled={novoClienteId === "" || loading}
                >
                  Abrir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
