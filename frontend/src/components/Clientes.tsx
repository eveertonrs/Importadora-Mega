// src/components/Clientes.tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import api from "../services/api";

type Cliente = {
  id: number;
  nome_fantasia: string;
  tabela_preco?: string | null;
  status?: "ATIVO" | "INATIVO";
  whatsapp?: string | null;
};

const PAGE_SIZE = 10;

export default function Clientes() {
  const nav = useNavigate();

  // filtros
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ATIVO" | "INATIVO">("");

  // dados/estado
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // paginação
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // qual menu está aberto (apenas 1 por vez)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // debounce simples (400ms)
  const debounceMs = 400;
  const timerRef = useRef<number | null>(null);
  const debounced = useMemo(() => search.trim(), [search]);

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
        },
      });
      setRows(data?.data ?? []);
      setTotal(Number(data?.total ?? 0));
      setPage(Number(data?.page ?? p));
      setOpenMenuId(null); // fecha qualquer menu ao recarregar
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
  }, [debounced, status]);

  async function toggleStatus(c: Cliente) {
    try {
      await api.put(`/clientes/${c.id}`, {
        status: c.status === "ATIVO" ? "INATIVO" : "ATIVO",
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao atualizar status.");
    }
  }

  async function excluir(c: Cliente) {
    if (!confirm(`Inativar o cliente "${c.nome_fantasia}"?`)) return;
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

  // fecha menus em ações globais
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
            <div className="flex gap-2">
              <input
                className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Nome, WhatsApp…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="mt-1 rounded border px-3 py-2 hover:bg-slate-50"
                  onClick={() => setSearch("")}
                  title="Limpar"
                >
                  Limpar
                </button>
              )}
            </div>
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
              <th className="p-2 border w-16">#</th>
              <th className="p-2 border">Nome fantasia</th>
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
                    <td className="p-2 border"><div className="h-4 w-8 bg-slate-100 animate-pulse rounded" /></td>
                    <td className="p-2 border"><div className="h-4 w-48 bg-slate-100 animate-pulse rounded" /></td>
                    <td className="p-2 border"><div className="h-4 w-24 bg-slate-100 animate-pulse rounded" /></td>
                    <td className="p-2 border"><div className="h-5 w-20 bg-slate-100 animate-pulse rounded" /></td>
                    <td className="p-2 border text-center"><div className="h-4 w-8 bg-slate-100 animate-pulse rounded mx-auto" /></td>
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
                      <button onClick={() => nav("/clientes/novo")} className="text-blue-700 underline">
                        crie um cliente
                      </button>.
                    </div>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((c) => (
                <Row
                  key={c.id}
                  c={c}
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

      {/* Paginação */}
      <div className="flex items-center justify-between text-sm">
        <div>Mostrando <b>{rows.length}</b> de <b>{total}</b></div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => canPrev && load(page - 1)}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            ‹ Anterior
          </button>
          <div className="px-2 py-1">Página <b>{page}</b> / {totalPages}</div>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => canNext && load(page + 1)}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Próxima ›
          </button>
        </div>
      </div>
    </div>
  );
}

/** ─── Linha + Menu em Portal ─────────────────────────────────────────── */
function Row({
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

  return (
    <tr className="hover:bg-slate-50">
      <td className="p-2 border align-top">{c.id}</td>
      <td className="p-2 border align-top">
        <div className="font-medium">{c.nome_fantasia}</div>
        {c.whatsapp && (
          <div className="text-xs">
            <a
              href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              {c.whatsapp}
            </a>
          </div>
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
              {c.status === "ATIVO" ? "Inativar" : "Reativar"}
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
              to={`/blocos?cliente=${c.id}`}
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

/** ─── Portal posicionado (abre pra cima ou pra baixo) ────────────────── */
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

  // posiciona após montar
  useLayoutEffect(() => {
    const el = anchorRef.current;
    const menuEl = menuRef.current;
    if (!el || !menuEl) return;

    const r = el.getBoundingClientRect();
    // medir tamanho do menu
    menuEl.style.visibility = "hidden";
    menuEl.style.display = "block";
    const mh = menuEl.offsetHeight || 200;
    const mw = menuEl.offsetWidth || 160;
    menuEl.style.visibility = "";
    menuEl.style.display = "";

    const below = window.innerHeight - r.bottom;
    const openUp = below < mh && r.top > below;

    const top = (openUp ? r.top - mh : r.bottom) + window.scrollY + 4;
    const left = r.right - mw + window.scrollX;

    setPos({ top, left, openUp });
  }, [anchorRef]);

  // fecha ao clicar fora
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && anchorRef.current && !anchorRef.current.contains(target)) {
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
