import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import api from "../services/api";

/* ===================== Tipos ===================== */
type Cliente = {
  id: number;
  nome_fantasia: string;
  tabela_preco?: string | null;
  status?: "ATIVO" | "INATIVO";
  ativo?: boolean;
  whatsapp?: string | null;
};

/* ===================== Helpers visuais ===================== */
const NAME_COLORS = [
  "bg-sky-100 text-sky-700 ring-sky-200",
  "bg-violet-100 text-violet-700 ring-violet-200",
  "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "bg-amber-100 text-amber-700 ring-amber-200",
  "bg-rose-100 text-rose-700 ring-rose-200",
  "bg-indigo-100 text-indigo-700 ring-indigo-200",
  "bg-teal-100 text-teal-700 ring-teal-200",
];

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}
function colorFor(id: number) {
  const idx = Math.abs(Number(id || 0)) % NAME_COLORS.length;
  return NAME_COLORS[idx];
}
function waLink(raw?: string | null) {
  if (!raw) return null;
  const phone = raw.replace(/\D/g, "");
  return phone ? `https://wa.me/${phone}` : null;
}

const PAGE_SIZE = 10;

/* =========================================================
   Página
   ========================================================= */
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

  /* Combos tabela */
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

  /* Debounce de filtros */
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

  /* Fecha menu ao rolar/redimensionar */
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
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white p-6 shadow">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Clientes</h1>
            <p className="text-slate-300">Gerencie cadastro e acesse rapidamente os blocos.</p>
          </div>
          <button
            onClick={() => nav("/clientes/novo")}
            className="rounded-xl bg-white/10 px-4 py-2 text-white ring-1 ring-white/30 hover:bg-white/20"
          >
            Novo cliente
          </button>
        </div>
      </section>

      {/* Filtros */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4 items-end">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Buscar</label>
            <div className="mt-1 flex gap-2">
              <div className="relative w-full">
                <input
                  className="peer w-full rounded-xl border px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Nome, WhatsApp…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 peer-focus:text-blue-500">
                  🔎
                </span>
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
            <label className="text-xs font-semibold text-slate-600">Status</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={status}
              onChange={(e) => setStatus((e.target.value as any) || "")}
            >
              <option value="">(todos)</option>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Tabela de preço</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
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
      </section>

      {/* Cabeçalho das colunas (desktop) */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_180px_140px_72px] items-center px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50 rounded-t-2xl border border-b-0">
        <div>Cliente</div>
        <div>Tabela</div>
        <div>Status</div>
        <div className="text-center">Ações</div>
      </div>

      {/* Lista com divisórias visíveis */}
      <section className="rounded-b-2xl md:rounded-t-none border bg-white shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-200" role="list">
          {/* Loading skeleton */}
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <li key={`sk-${i}`} className="px-4 py-3">
                <div className="grid md:grid-cols-[minmax(0,1fr)_180px_140px_72px] items-start gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-100 animate-pulse" />
                    <div className="space-y-1">
                      <div className="h-4 w-52 rounded bg-slate-100 animate-pulse" />
                      <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
                    </div>
                  </div>
                  <div className="h-5 w-20 rounded-full bg-slate-100 animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" />
                  <div className="mx-auto h-8 w-8 rounded bg-slate-100 animate-pulse" />
                </div>
              </li>
            ))}

          {/* Empty / erro */}
          {!loading && rows.length === 0 && (
            <li className="px-4 py-8 text-center">
              {err ? (
                <div className="inline-block rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                  {err}
                </div>
              ) : (
                <div className="text-slate-500">
                  Nada encontrado. Ajuste os filtros ou{" "}
                  <button onClick={() => nav("/clientes/novo")} className="text-blue-700 underline">
                    crie um cliente
                  </button>
                  .
                </div>
              )}
            </li>
          )}

          {/* Itens */}
          {!loading &&
            rows.map((c) => (
              <RowItem
                key={c.id}
                c={c}
                isOpen={openMenuId === c.id}
                onOpen={() => setOpenMenuId(c.id)}
                onClose={() => setOpenMenuId(null)}
                onToggle={() => toggleStatus(c)}
                onExcluir={() => excluir(c)}
              />
            ))}
        </ul>
      </section>

      {/* Paginação */}
      <section className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-slate-600">
          Mostrando <b>{rows.length}</b> de <b>{total}</b>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => canPrev && load(page - 1)}
            className="rounded-xl border px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
          >
            ‹ Anterior
          </button>
          <div className="px-2 py-1">Página <b>{page}</b> / {totalPages}</div>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => canNext && load(page + 1)}
            className="rounded-xl border px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
          >
            Próxima ›
          </button>
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   Item da lista
   ========================================================= */
function RowItem({
  c,
  isOpen,
  onOpen,
  onClose,
  onToggle,
  onExcluir,
}: {
  c: Cliente;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  onExcluir: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const ativo = (c as any).ativo === true || c.status === "ATIVO";
  const wa = waLink(c.whatsapp);

  return (
    <li className="px-4 py-3 hover:bg-slate-50 transition-colors">
      <div className="grid md:grid-cols-[minmax(0,1fr)_180px_140px_72px] items-start gap-3">
        {/* Cliente */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={[
              "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-2",
              colorFor(c.id),
            ].join(" ")}
            title={c.nome_fantasia}
            aria-hidden
          >
            {initials(c.nome_fantasia)}
          </div>

          <div className="min-w-0">
            <Link
              to={`/clientes/${c.id}`}
              className="block truncate font-semibold text-slate-800 hover:text-blue-700"
              title={c.nome_fantasia}
            >
              {c.nome_fantasia}
            </Link>

            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  title="Abrir WhatsApp"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                    <path d="M20.52 3.48A11 11 0 0 0 3.3 18.56L2 22l3.56-1.26A11 11 0 1 0 20.52 3.48Zm-8.1 16.06a9.1 9.1 0 0 1-4.64-1.27l-.33-.2-2.06.73.71-2.01-.22-.34a9.08 9.08 0 1 1 6.54 3.09ZM17 14.3c-.1-.15-.39-.24-.82-.43s-.51-.16-.73.13-.28.41-.52.37a6.2 6.2 0 0 1-2.93-1.8 3.38 3.38 0 0 1-.73-1.25c-.08-.25 0-.38.29-.64s.33-.39.49-.65.08-.46 0-.65c-.14-.24-.73-1.77-1-2.42s-.56-.56-.77-.57h-.65a1.25 1.25 0 0 0-.9.42 3.79 3.79 0 0 0-1.2 2.82 6.6 6.6 0 0 0 1.38 3.46 7.58 7.58 0 0 0 3.4 2.77 7.54 7.54 0 0 0 3.6.83c.37 0 .74-.06 1.1-.11a2.54 2.54 0 0 0 1.72-1.18 2.1 2.1 0 0 0 .15-1.15Z" />
                  </svg>
                  {c.whatsapp}
                </a>
              ) : (
                <span className="text-slate-400">sem WhatsApp</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="md:justify-self-start">
          {c.tabela_preco ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
              {c.tabela_preco}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>

        {/* Status */}
        <div>
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
              ativo
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-rose-200",
            ].join(" ")}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {ativo ? "ATIVO" : "INATIVO"}
          </span>
        </div>

        {/* Ações */}
        <div className="text-center md:justify-self-center">
          <button
            ref={btnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              isOpen ? onClose() : onOpen();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            title="Ações"
          >
            ⋮
          </button>

          {isOpen && (
            <MenuPortal anchorRef={btnRef} onClose={onClose}>
              <MenuItem asLink to={`/clientes/${c.id}`} onClick={onClose} icon="↗">
                Abrir
              </MenuItem>
              <MenuItem asLink to={`/clientes/${c.id}/editar`} onClick={onClose} icon="✏️">
                Editar
              </MenuItem>
              <MenuItem onClick={() => { onClose(); onToggle(); }} icon={(c as any).ativo || c.status === "ATIVO" ? "⏸️" : "▶️"} tone="amber">
                {(c as any).ativo || c.status === "ATIVO" ? "Inativar" : "Reativar"}
              </MenuItem>
              <MenuItem onClick={() => { onClose(); onExcluir(); }} icon="🗑️" tone="red">
                Excluir
              </MenuItem>
              <MenuItem asLink to={`/blocos?cliente_id=${c.id}`} onClick={onClose} icon="🧩" tone="emerald">
                Blocos
              </MenuItem>
            </MenuPortal>
          )}
        </div>
      </div>
    </li>
  );
}

/* =========================================================
   Menu / Portal
   ========================================================= */
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

    // medir
    const r = el.getBoundingClientRect();
    menuEl.style.visibility = "hidden";
    menuEl.style.display = "block";
    const mh = menuEl.offsetHeight || 200;
    const mw = menuEl.offsetWidth || 192;
    menuEl.style.visibility = "";
    menuEl.style.display = "";

    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < mh && r.top > spaceBelow;

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
      className="z-50 w-48 rounded-xl border bg-white/95 shadow-xl backdrop-blur p-1"
      style={{ position: "absolute", top: pos.top, left: pos.left }}
    >
      {children}
    </div>,
    document.body
  );
}

/* MenuItem genérico com ícone e variações de cor */
function MenuItem(props: {
  asLink?: boolean;
  to?: string;
  onClick?: () => void;
  icon?: string;
  tone?: "red" | "amber" | "emerald" | "default";
  children: React.ReactNode;
}) {
  const { asLink, to = "#", onClick, icon, tone = "default", children } = props;

  const toneCls =
    tone === "red"
      ? "text-rose-700 hover:bg-rose-50"
      : tone === "amber"
      ? "text-amber-700 hover:bg-amber-50"
      : tone === "emerald"
      ? "text-emerald-700 hover:bg-emerald-50"
      : "text-slate-700 hover:bg-slate-50";

  const content = (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${toneCls}`}>
      {icon && <span className="text-base leading-none">{icon}</span>}
      <span className="text-sm">{children}</span>
    </div>
  );

  if (asLink) {
    return (
      <Link to={to} onClick={onClick} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}
