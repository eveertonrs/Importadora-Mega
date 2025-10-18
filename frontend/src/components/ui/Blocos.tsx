import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listarBlocos } from "../../services/blocos.api";
import api from "../../services/api";
import type { Bloco, BlocoStatus } from "../../services/blocos.api";

/** =================== debounce simples =================== */
function useDebounce<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** =================== tipos locais =================== */
type Cliente = { id: number; nome_fantasia: string };

type SortKey = "cliente" | "status";
type SortDir = "asc" | "desc";

/** =================== componente =================== */
export default function Blocos() {
  const [sp, setSp] = useSearchParams();

  /** ------------ Filtros / URL ------------ */
  const [clienteNome, setClienteNome] = useState<string>(sp.get("q") ?? "");
  const initialClienteIdParam = sp.get("cliente_id");
  const [clienteId] = useState<number | null>(initialClienteIdParam ? Number(initialClienteIdParam) : null);

  const initialStatus = (sp.get("status") as BlocoStatus | "") || "ABERTO";
  const [status, setStatus] = useState<BlocoStatus | "">(initialStatus);

  const [page, setPage] = useState<number>(Number(sp.get("page") || 1));
  const [limit, setLimit] = useState<number>(Number(sp.get("limit") || 10));

  // ordenação
  const [sortKey, setSortKey] = useState<SortKey>((sp.get("sortKey") as SortKey) || "cliente");
  const [sortDir, setSortDir] = useState<SortDir>((sp.get("sortDir") as SortDir) || "asc");

  /** ------------ Dados ------------ */
  const [rows, setRows] = useState<Bloco[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** ------------ Modal novo bloco ------------ */
  const [openNew, setOpenNew] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteId, setNovoClienteId] = useState<number | "">("");
  const [novaObs, setNovaObs] = useState("");

  // feedback do modal
  const [newErrMsg, setNewErrMsg] = useState<string | undefined>(undefined);
  const [newErrBlocoId, setNewErrBlocoId] = useState<number | undefined>(undefined);

  // auto-complete
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const [cliOpen, setCliOpen] = useState(false);
  const [cliActiveIndex, setCliActiveIndex] = useState<number>(-1);
  const [cliLoadingNew, setCliLoadingNew] = useState(false);

  const debouncedBuscaCliente = useDebounce(novoClienteNome, 300);
  const cliBoxRef = useRef<HTMLDivElement>(null);
  const inputNewRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!cliBoxRef.current?.contains(e.target as Node)) setCliOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (openNew) {
      setTimeout(() => inputNewRef.current?.focus(), 50);
    }
  }, [openNew]);

  useEffect(() => {
    if (debouncedBuscaCliente.trim().length < 2 || novoClienteId !== "") {
      setCliOpts([]);
      setCliOpen(false);
      setCliActiveIndex(-1);
      setCliLoadingNew(false);
      return;
    }
    let cancel = false;
    setCliLoadingNew(true);
    (async () => {
      try {
        const { data } = await api.get("/clientes", {
          params: { search: debouncedBuscaCliente, limit: 10 },
        });
        if (cancel) return;
        const list: Cliente[] = (data?.data ?? data ?? []).slice(0, 10);
        setCliOpts(list);
        setCliOpen(list.length > 0);
        setCliActiveIndex(list.length ? 0 : -1);
      } catch {
        // silencioso
      } finally {
        if (!cancel) setCliLoadingNew(false);
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
    setCliActiveIndex(-1);
    setNewErrMsg(undefined);
    setNewErrBlocoId(undefined);
    inputNewRef.current?.focus();
  }

  const debouncedNome = useDebounce(clienteNome, 400);

  /** ------------ URL Sync ------------ */
  useEffect(() => {
    const p = new URLSearchParams(sp);
    p.set("q", clienteNome);
    status ? p.set("status", status) : p.delete("status");
    p.set("page", String(page));
    p.set("limit", String(limit));
    p.set("sortKey", sortKey);
    p.set("sortDir", sortDir);
    if (sp.get("cliente_id")) p.set("cliente_id", sp.get("cliente_id") as string);
    setSp(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteNome, status, page, limit, sortKey, sortDir]);

  /** ------------ Carregar ------------ */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSkeleton(rows.length === 0);

    try {
      const r = await listarBlocos({
        cliente_id: clienteId ?? undefined,
        cliente: clienteId ? undefined : debouncedNome || undefined,
        status: status || undefined,
        page,
        limit,
      } as any);

      let list: Bloco[] = (r.data ?? []) as Bloco[];

      // ordenação no front
      list = list.slice().sort((a, b) => {
        if (sortKey === "cliente") {
          const an = (a.cliente_nome ?? "").toLocaleLowerCase();
          const bn = (b.cliente_nome ?? "").toLocaleLowerCase();
          return sortDir === "asc" ? an.localeCompare(bn, "pt-BR") : bn.localeCompare(an, "pt-BR");
        }
        const av = a.status ?? "";
        const bv = b.status ?? "";
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });

      setRows(list);
      setTotal(Number(r.total ?? list.length));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha ao carregar os blocos.");
    } finally {
      setLoading(false);
      setSkeleton(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNome, status, page, limit, clienteId, sortKey, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  const canNext = page * limit < total;

  /** ------------ Abrir bloco ------------ */
  async function handleCriarBloco() {
    if (novoClienteId === "") {
      setNewErrMsg("Selecione um cliente para abrir o bloco.");
      setNewErrBlocoId(undefined);
      return;
    }
    try {
      setLoading(true);
      setNewErrMsg(undefined);
      setNewErrBlocoId(undefined);

      const { data } = await api.post("/blocos", {
        cliente_id: Number(novoClienteId),
        observacao: novaObs || undefined,
      });
      setOpenNew(false);
      limparCliente();
      setNovaObs("");
      window.location.href = `/blocos/${data?.id ?? data?.data?.id}`;
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Falha ao abrir bloco.";
      const existente = e?.response?.status === 409 ? Number(e?.response?.data?.bloco_aberto_id) : undefined;
      setNewErrMsg(msg);
      setNewErrBlocoId(existente);
    } finally {
      setLoading(false);
    }
  }

  /** ------------ Helpers UI ------------ */
  const totalLabel = useMemo(() => {
    if (!total) return "0 resultado";
    if (total === 1) return "1 resultado";
    return `${total} resultados`;
  }, [total]);

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      setPage(1);
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  const SortIcon = ({ dir }: { dir: SortDir }) => (
    <span className="ml-1 inline-block select-none align-middle">{dir === "asc" ? "▲" : "▼"}</span>
  );

  /** ------------ Render ------------ */
  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50 to-fuchsia-50 border shadow-sm p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Blocos</h1>
          <p className="text-slate-600 text-sm">
            Gerencie os blocos por cliente. <span className="font-medium">{totalLabel}</span>.
          </p>
        </div>
        <button
          onClick={() => {
            setOpenNew(true);
            setNewErrMsg(undefined);
            setNewErrBlocoId(undefined);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow"
        >
          Abrir novo bloco
        </button>
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente</label>
            <input
              type="text"
              className="border rounded-xl px-3 py-2 w-full outline-none focus:ring-2 focus:ring-sky-200"
              value={clienteNome}
              onChange={(e) => {
                setPage(1);
                setClienteNome(e.target.value);
              }}
              placeholder="digite o nome…"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              className="border rounded-xl px-3 py-2 w-full outline-none focus:ring-2 focus:ring-sky-200"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus((e.target.value || "") as BlocoStatus | "");
              }}
            >
              <option value="ABERTO">ABERTO</option>
              <option value="FECHADO">FECHADO</option>
              <option value="">(todos)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Limite</label>
            <select
              className="border rounded-xl px-3 py-2 w-full outline-none focus:ring-2 focus:ring-sky-200"
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
        </div>
        <div className="px-4 pb-4 flex items-center gap-2">
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
          {loading && <span className="text-sm text-slate-500">carregando resultados…</span>}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-2">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur border-b">
              <tr>
                <th
                  className="p-3 text-left font-medium text-slate-700 select-none"
                  role="button"
                  onClick={() => toggleSort("cliente")}
                >
                  Cliente
                  {sortKey === "cliente" && <SortIcon dir={sortDir} />}
                </th>
                <th
                  className="p-3 text-left font-medium text-slate-700 select-none"
                  role="button"
                  onClick={() => toggleSort("status")}
                >
                  Status
                  {sortKey === "status" && <SortIcon dir={sortDir} />}
                </th>
                <th className="p-3 text-left font-medium text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {skeleton &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td className="p-3 border-b">
                      <div className="h-3 w-40 bg-slate-200 rounded" />
                    </td>
                    <td className="p-3 border-b">
                      <div className="h-5 w-16 bg-slate-200 rounded-full" />
                    </td>
                    <td className="p-3 border-b">
                      <div className="h-3 w-12 bg-slate-200 rounded" />
                    </td>
                  </tr>
                ))}

              {!skeleton &&
                rows.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/80 cursor-pointer"
                    onClick={() => (window.location.href = `/blocos/${b.id}`)}
                  >
                    <td className="p-3 border-b">{b.cliente_nome ?? b.cliente_id}</td>
                    <td className="p-3 border-b">
                      <span
                        className={
                          "text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide " +
                          (b.status === "ABERTO"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-200 text-slate-700")
                        }
                        aria-label={`Status ${b.status}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 border-b">
                      <Link
                        to={`/blocos/${b.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-700 hover:text-blue-800 underline"
                        aria-label={`Abrir bloco #${b.id}`}
                      >
                        Detalhe
                      </Link>
                    </td>
                  </tr>
                ))}

              {!skeleton && rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="p-10 text-center">
                    <div className="space-y-2">
                      <div className="text-slate-500">Nenhum bloco encontrado com os filtros atuais.</div>
                      <button
                        onClick={() => {
                          setNewErrMsg(undefined);
                          setNewErrBlocoId(undefined);
                          setOpenNew(true);
                        }}
                        className="inline-flex items-center px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
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

        {/* Rodapé / paginação */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Página {page}
            {loading && <span className="opacity-60"> • carregando…</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-xl border hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Anterior
            </button>
            <button
              className="px-3 py-1.5 rounded-xl border hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
              disabled={!canNext || loading}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal novo bloco — versão melhorada */}
      {openNew && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setOpenNew(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl ring-1 ring-slate-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="novo-bloco-title"
          >
            <div className="rounded-t-2xl bg-gradient-to-r from-slate-50 to-white px-5 py-4 border-b">
              <h2 id="novo-bloco-title" className="text-lg font-semibold">Abrir novo bloco</h2>
              <p className="text-slate-500 text-sm">Selecione o cliente e, se quiser, informe uma observação.</p>
            </div>

            <div className="p-5 space-y-4" ref={cliBoxRef}>
              {/* erro elegante */}
              {newErrMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
                  <span className="mt-0.5">⚠️</span>
                  <div className="flex-1">
                    <div className="font-medium">{newErrMsg}</div>
                    {newErrBlocoId && (
                      <button
                        type="button"
                        className="mt-1 text-blue-700 underline underline-offset-2 hover:text-blue-800"
                        onClick={() => (window.location.href = `/blocos/${newErrBlocoId}`)}
                      >
                        Abrir bloco #{newErrBlocoId}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* cliente + autocomplete */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente</label>
                <div className="relative">
                  <input
                    ref={inputNewRef}
                    className="peer border rounded-xl px-3 py-2 w-full pr-24 outline-none focus:ring-2 focus:ring-sky-200"
                    value={novoClienteNome}
                    onChange={(e) => {
                      setNovoClienteNome(e.target.value);
                      if (novoClienteId !== "") setNovoClienteId("");
                      setNewErrMsg(undefined);
                      setNewErrBlocoId(undefined);
                    }}
                    onFocus={() => {
                      if (cliOpts.length > 0) setCliOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        if (cliOpen) { setCliOpen(false); return; }
                        setOpenNew(false);
                        return;
                      }
                      if (!cliOpen || cliOpts.length === 0) {
                        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") {
                          e.preventDefault();
                          void handleCriarBloco();
                        }
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setCliActiveIndex((i) => Math.min(cliOpts.length - 1, i + 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setCliActiveIndex((i) => Math.max(0, i - 1));
                      } else if (e.key === "Enter" && cliActiveIndex >= 0) {
                        e.preventDefault();
                        selecionarCliente(cliOpts[cliActiveIndex]);
                      }
                    }}
                    placeholder="Digite para buscar…"
                    aria-autocomplete="list"
                    aria-expanded={cliOpen}
                    aria-controls="autocomplete-clientes"
                  />
                  {(novoClienteId !== "" || novoClienteNome) && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                      onClick={limparCliente}
                      title="Limpar"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {novoClienteId !== "" && (
                  <div className="mt-1 text-xs text-slate-600">
                    Selecionado:{" "}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                      <span className="text-slate-500">#</span>{novoClienteId}
                    </span>
                  </div>
                )}

                {cliOpen && (
                  <div id="autocomplete-clientes" className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-xl max-h-72 overflow-auto" role="listbox">
                    {cliLoadingNew && (
                      <div className="px-3 py-2 text-sm text-slate-500">Carregando…</div>
                    )}
                    {!cliLoadingNew && cliOpts.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500">Nenhum cliente encontrado.</div>
                    )}
                    {cliOpts.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={idx === cliActiveIndex}
                        className={[
                          "block w-full text-left px-3 py-2 hover:bg-slate-50",
                          idx === cliActiveIndex ? "bg-slate-50" : "",
                        ].join(" ")}
                        onMouseEnter={() => setCliActiveIndex(idx)}
                        onClick={() => selecionarCliente(c)}
                      >
                        <div className="font-medium truncate">{c.nome_fantasia}</div>
                        <div className="text-xs text-slate-500">#{c.id}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* observação */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observação <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <textarea
                    className="border rounded-xl px-3 py-2 w-full outline-none focus:ring-2 focus:ring-sky-200 min-h-[84px] resize-y"
                    value={novaObs}
                    maxLength={400}
                    onChange={(e) => setNovaObs(e.target.value)}
                    placeholder="Ex.: abrir bloco para novos títulos…"
                  />
                  <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-slate-400">
                    {novaObs.length}/400
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t rounded-b-2xl bg-slate-50">
              <button className="px-3 py-2 rounded-xl border hover:bg-white" onClick={() => setOpenNew(false)}>
                Cancelar
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                onClick={handleCriarBloco}
                disabled={novoClienteId === "" || loading}
                title="Ctrl + Enter"
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                Abrir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
