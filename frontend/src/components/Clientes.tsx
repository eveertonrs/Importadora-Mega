import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import api from "../services/api";

type Cliente = {
  id: number;
  nome_fantasia: string;
  tabela_preco?: string | null;
  status?: "ATIVO" | "INATIVO";
  ativo?: boolean;
  whatsapp?: string | null;
};

// Paleta suave p/ os avatares
const NAME_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}
function colorFor(id: number) {
  const idx = Math.abs(Number(id || 0)) % NAME_COLORS.length;
  return NAME_COLORS[idx];
}

const PAGE_SIZE = 10;

export default function Clientes() {
  const nav = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ATIVO" | "INATIVO">("");
  const [tabela, setTabela] = useState<string>("");

  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [tabelas, setTabelas] = useState<string[]>([]);

  const debounceMs = 400;
  const timerRef = useRef<number | null>(null);
  const debounced = useMemo(() => search.trim(), [search]);

  // combos de tabela
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        try {
          const { data } = await api.get("/tabelas-preco", { headers: { "x-silent": "1" } });
          if (!cancel) setTabelas((data?.data ?? data ?? []) as string[]);
        } catch {
          const { data } = await api.get("/clientes/tabelas-preco", { headers: { "x-silent": "1" } });
          if (!cancel) setTabelas((data?.data ?? data ?? []) as string[]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  async function load(p = page) {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get("/clientes", {
        params: {
          page: p,
          limit: PAGE_SIZE,
          search: debounced || undefined,
          status: status || undefined,
          tabela_preco: tabela || undefined,
        },
      });

      const list: Cliente[] = data?.data ?? [];
      list.sort((a, b) => (a.nome_fantasia || "").localeCompare(b.nome_fantasia || "", "pt-BR"));

      setRows(list);
      setTotal(Number(data?.total ?? list.length));
      setPage(Number(data?.page ?? p));
      setOpenMenuId(null);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Falha ao carregar clientes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => load(1), debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, status, tabela]);

  async function toggleStatus(c: Cliente) {
    const ativoAtual = (c as any).ativo === true || c.status === "ATIVO";
    const novoStatus = ativoAtual ? "INATIVO" : "ATIVO";
    try {
      await api.put(`/clientes/${c.id}`, { status: novoStatus });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao atualizar status.");
    }
  }

  async function excluir(c: Cliente) {
    if (!confirm(`Excluir o cliente "${c.nome_fantasia}"?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/clientes/${c.id}`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao excluir.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Título + CTA */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-slate-500">Gerencie cadastro e acesso rápido aos blocos.</p>
        </div>
        <button
          onClick={() => nav("/clientes/novo")}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
        >
          Novo cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600">Buscar</label>
            <div className="mt-1 flex gap-2">
              <div className="relative w-full">
                <input
                  className="border rounded-xl px-3 py-2 w-full pl-9 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Nome, WhatsApp…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
              </div>
              {search && (
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 hover:bg-slate-50"
                  onClick={() => setSearch("")}
                  title="Limpar"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Status</label>
            <select
              className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={status}
              onChange={(e) => setStatus((e.target.value as any) || "")}
            >
              <option value="">(todos)</option>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Tabela de preço</label>
            <select
              className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={tabela}
              onChange={(e) => setTabela(e.target.value)}
            >
              <option value="">(todas)</option>
              {tabelas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="p-2 border">Cliente</th>
              <th className="p-2 border w-40">Tabela</th>
              <th className="p-2 border w-28">Status</th>
              <th className="p-2 border w-12 text-center">⋮</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <>
                {[...Array(4)].map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td className="p-2 border">
                      <div className="h-4 w-48 bg-slate-100 animate-pulse rounded" />
                      <div className="mt-1 h-3 w-28 bg-slate-100 animate-pulse rounded" />
                    </td>
                    <td className="p-2 border">
                      <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                    </td>
                    <td className="p-2 border">
                      <div className="h-5 w-20 bg-slate-100 animate-pulse rounded" />
                    </td>
                    <td className="p-2 border text-center">
                      <div className="h-4 w-8 bg-slate-100 animate-pulse rounded mx-auto" />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center">
                  {err ? (
                    <div className="text-red-700">{err}</div>
                  ) : (
                    <div className="text-slate-500">
                      Nada encontrado. Ajuste a busca ou{" "}
                      <button onClick={() => nav("/clientes/novo")} className="text-blue-700 underline">
                        crie um cliente
                      </button>
                      .
                    </div>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((c, idx) => (
                <Row
                  key={c.id}
                  c={c}
                  zebra={idx % 2 === 1}
                  isOpen={openMenuId === c.id}
                  onOpen={() => setOpenMenuId(c.id)}
                  onClose={() => setOpenMenuId(null)}
                  onToggle={() => toggleStatus(c)}
                  onExcluir={() => excluir(c)}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* paginação */}
      <div className="flex items-center justify-between text-sm">
        <div>
          Mostrando <b>{rows.length}</b> de <b>{total}</b>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => canPrev && load(page - 1)}
            className="rounded-xl border px-3 py-1 disabled:opacity-50 hover:bg-slate-50"
          >
            ‹ Anterior
          </button>
          <div className="px-2 py-1">
            Página <b>{page}</b> / {totalPages}
          </div>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => canNext && load(page + 1)}
            className="rounded-xl border px-3 py-1 disabled:opacity-50 hover:bg-slate-50"
          >
            Próxima ›
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  c,
  zebra,
  isOpen,
  onOpen,
  onClose,
  onToggle,
  onExcluir,
}: {
  c: Cliente;
  zebra: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  onExcluir: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const ativo = (c as any).ativo === true || c.status === "ATIVO";

  return (
    <tr className={`${zebra ? "bg-slate-50/40" : ""} hover:bg-slate-50`}>
      {/* Cliente + WhatsApp (COM AVATAR E TIPOGRAFIA) */}
      <td className="p-2 border align-top">
        <div className="flex items-start gap-3">
          {/* Avatar com iniciais */}
          <div
            className={[
              "mt-0.5 h-8 w-8 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold ring-1 ring-black/5",
              colorFor(c.id),
            ].join(" ")}
            aria-hidden
            title={c.nome_fantasia}
          >
            {initials(c.nome_fantasia)}
          </div>

          {/* Nome + WhatsApp */}
          <div className="min-w-0">
            <Link
              to={`/clientes/${c.id}`}
              className="block truncate font-semibold text-slate-800 hover:text-blue-700"
              title={c.nome_fantasia}
            >
              {c.nome_fantasia}
            </Link>

            {c.whatsapp && (
              <a
                href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                title="Abrir conversa no WhatsApp"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M20.52 3.48A11 11 0 0 0 3.3 18.56L2 22l3.56-1.26A11 11 0 1 0 20.52 3.48Zm-8.1 16.06a9.1 9.1 0 0 1-4.64-1.27l-.33-.2-2.06.73.71-2.01-.22-.34a9.08 9.08 0 1 1 6.54 3.09ZM17 14.3c-.1-.15-.39-.24-.82-.43s-.51-.16-.73.13-.28.41-.52.37a6.2 6.2 0 0 1-2.93-1.8 3.38 3.38 0 0 1-.73-1.25c-.08-.25 0-.38.29-.64s.33-.39.49-.65.08-.46 0-.65c-.14-.24-.73-1.77-1-2.42s-.56-.56-.77-.57h-.65a1.25 1.25 0 0 0-.9.42 3.79 3.79 0 0 0-1.2 2.82 6.6 6.6 0 0 0 1.38 3.46 7.58 7.58 0 0 0 3.4 2.77 7.54 7.54 0 0 0 3.6.83c.37 0 .74-.06 1.1-.11a2.54 2.54 0 0 0 1.72-1.18 2.1 2.1 0 0 0 .15-1.15Z" />
                </svg>
                {c.whatsapp}
              </a>
            )}
          </div>
        </div>
      </td>

      {/* Tabela */}
      <td className="p-2 border align-top">{c.tabela_preco ?? "-"}</td>

      {/* Status */}
      <td className="p-2 border align-top">
        <span
          className={[
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1",
            ativo ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200",
          ].join(" ")}
        >
          {ativo ? "ATIVO" : "INATIVO"}
        </span>
      </td>

      {/* Ações */}
      <td className="p-2 border align-top text-center">
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            isOpen ? onClose() : onOpen();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title="Ações"
        >
          ⋮
        </button>

        {isOpen && (
          <MenuPortal anchorRef={btnRef} onClose={onClose}>
            <Link to={`/clientes/${c.id}`} className="block px-3 py-2 text-sm hover:bg-slate-50" onClick={onClose}>
              Abrir
            </Link>
            <Link to={`/clientes/${c.id}/editar`} className="block px-3 py-2 text-sm hover:bg-slate-50" onClick={onClose}>
              Editar
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose();
                onToggle();
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-amber-700"
            >
              {ativo ? "Inativar" : "Reativar"}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onExcluir();
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-red-700"
            >
              Excluir
            </button>
            <Link
              to={`/blocos?cliente_id=${c.id}`}
              className="block px-3 py-2 text-sm hover:bg-slate-50 text-emerald-700"
              onClick={onClose}
            >
              Blocos
            </Link>
          </MenuPortal>
        )}
      </td>
    </tr>
  );
}

function MenuPortal({
  anchorRef,
  children,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });

  useLayoutEffect(() => {
    const el = anchorRef.current;
    const menuEl = menuRef.current;
    if (!el || !menuEl) return;

    const r = el.getBoundingClientRect();
    menuEl.style.visibility = "hidden";
    menuEl.style.display = "block";
    const mh = menuEl.offsetHeight || 200;
    const mw = menuEl.offsetWidth || 180;
    menuEl.style.visibility = "";
    menuEl.style.display = "";

    const below = window.innerHeight - r.bottom;
    const openUp = below < mh && r.top > below;

    const top = (openUp ? r.top - mh : r.bottom) + window.scrollY + 6;
    const left = r.right - mw + window.scrollX;

    setPos({ top, left, openUp });
  }, [anchorRef]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="z-50 w-44 rounded-md border bg-white shadow-lg"
      style={{ position: "absolute", top: pos.top, left: pos.left }}
    >
      {children}
    </div>,
    document.body
  );
}
