import { useEffect, useMemo, useState } from "react";
import {
  conferenciaDiaria,
  conferenciaConfirmar,
  conferenciaDivergir,
  conferenciaDesfazer,
} from "../../services/financeiro";
import type { ConferenciaResult } from "../../services/financeiro";
import { ensureClientNames, getClientName } from "../../utils/clientNameCache";

// ===================== Tipos locais de UI =====================
export type OrigemConferencia = "BLOCO_LANC" | "TITULO" | "BAIXA";
export type StatusConferencia = "PENDENTE" | "CONFIRMADO" | "DIVERGENTE";

type ConferenciaItem = ConferenciaResult["itens"][number];

const BRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DATE = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "-";
const keyOf = (it: Pick<ConferenciaItem, "origem" | "origem_id">) =>
  `${it.origem}:${it.origem_id}`;

function Pill({
  children,
  tone = "slate",
}: {
  children: any;
  tone?: "slate" | "violet" | "amber" | "blue" | "rose" | "emerald";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    violet: "bg-violet-100 text-violet-700 ring-violet-200",
    amber: "bg-amber-100 text-amber-800 ring-amber-200",
    blue: "bg-blue-100 text-blue-700 ring-blue-200",
    rose: "bg-rose-100 text-rose-700 ring-rose-200",
    emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function StatusPill({ value }: { value?: StatusConferencia }) {
  if (value === "CONFIRMADO") return <Pill tone="emerald">CONFIRMADO</Pill>;
  if (value === "DIVERGENTE") return <Pill tone="rose">DIVERGENTE</Pill>;
  return <Pill tone="amber">PENDENTE</Pill>;
}

/** Verde = SAÍDA (valor >= 0), Vermelho = ENTRADA (valor < 0) */
function rowBgByValor(valor: number) {
  return Number(valor ?? 0) >= 0 ? "bg-emerald-50/80" : "bg-rose-50/80";
}

function IconCheck({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconAlert({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconUndo({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

export default function Conferencia() {
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [itens, setItens] = useState<ConferenciaItem[]>([]);
  const [resumo, setResumo] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // seleção
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // filtros locais
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | StatusConferencia>("");
  const [showLanc, setShowLanc] = useState(true);
  const [showTitulos, setShowTitulos] = useState(true);
  const [showBaixas, setShowBaixas] = useState(true);
  const [hideConfirmados, setHideConfirmados] = useState(false);

  // modal de divergência
  const [divModalOpen, setDivModalOpen] = useState(false);
  const [divComentario, setDivComentario] = useState("");

  // ------- Loader principal -------
  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const resp = await conferenciaDiaria({ data: date });

      // cache de nomes de clientes (melhora UX)
      const ids = Array.from(
        new Set((resp.itens || []).map((r) => r.cliente_id).filter(Boolean))
      );
      await ensureClientNames(ids);

      setItens(
        (resp.itens || []).map((r) => ({
          ...r,
          cliente_nome: getClientName(
            r.cliente_id,
            r.cliente_nome || undefined
          ),
        }))
      );
      setResumo(resp.resumo || {});
      setSelected(new Set());
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Falha ao carregar conferência.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- Derivados -------
  const filtered = useMemo(() => {
    let rows = itens.slice();
    if (!showLanc) rows = rows.filter((r) => r.origem !== "BLOCO_LANC");
    if (!showTitulos) rows = rows.filter((r) => r.origem !== "TITULO");
    if (!showBaixas) rows = rows.filter((r) => r.origem !== "BAIXA");

    if (hideConfirmados)
      rows = rows.filter((r) => r.status_conferencia !== "CONFIRMADO");
    if (filterStatus)
      rows = rows.filter((r) => r.status_conferencia === filterStatus);

    const q = filterText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.cliente_nome, r.tipo, r.numero_doc, r.status_negocio]
          .map((x) => String(x || "").toLowerCase())
          .some((s) => s.includes(q))
      );
    }
    // Agrupar por cliente e ordenar alfabeticamente (nomes um em seguida do outro)
    rows.sort((a, b) => {
      const nomeA = (a.cliente_nome || "").trim().toLowerCase();
      const nomeB = (b.cliente_nome || "").trim().toLowerCase();
      const cmp = nomeA.localeCompare(nomeB, "pt-BR");
      if (cmp !== 0) return cmp;
      return (a.origem_id ?? a.id) - (b.origem_id ?? b.id);
    });
    return rows;
  }, [
    itens,
    showLanc,
    showTitulos,
    showBaixas,
    hideConfirmados,
    filterStatus,
    filterText,
  ]);

  const selectedCount = selected.size;
  const allVisibleSelected = useMemo(
    () => filtered.every((r) => selected.has(keyOf(r))) && filtered.length > 0,
    [filtered, selected]
  );
  const totals = useMemo(() => {
    const sum = (acc: number, n: number) => acc + Number(n || 0);
    return {
      visivel: filtered.reduce((a, r) => sum(a, r.valor), 0),
      selecionado: filtered
        .filter((r) => selected.has(keyOf(r)))
        .reduce((a, r) => sum(a, r.valor), 0),
    };
  }, [filtered, selected]);

  // ------- Ações de conferência -------
  async function doConfirmar(rows: ConferenciaItem[]) {
    if (!rows.length) return;
    try {
      await conferenciaConfirmar({
        data: date,
        itens: rows.map((r) => ({ origem: r.origem, origem_id: r.origem_id })),
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao confirmar.");
    }
  }

  async function doDesfazer(rows: ConferenciaItem[]) {
    if (!rows.length) return;
    try {
      await conferenciaDesfazer({
        data: date,
        itens: rows.map((r) => ({ origem: r.origem, origem_id: r.origem_id })),
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao desfazer.");
    }
  }

  async function doDivergir(rows: ConferenciaItem[], comentario: string) {
    if (!rows.length) return;
    try {
      await conferenciaDivergir({
        data: date,
        comentario,
        itens: rows.map((r) => ({ origem: r.origem, origem_id: r.origem_id })),
      });
      setDivComentario("");
      setDivModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao marcar como divergente.");
    }
  }

  const toggleSelectAllVisible = () => {
    const next = new Set(selected);
    if (allVisibleSelected) {
      filtered.forEach((r) => next.delete(keyOf(r)));
    } else {
      filtered.forEach((r) => next.add(keyOf(r)));
    }
    setSelected(next);
  };

  const toggleOne = (row: ConferenciaItem) => {
    const k = keyOf(row);
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  };

  return (
    <div className="space-y-5">
      {/* Filtros superiores */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 items-end">
          <div className="lg:col-span-2">
            <label className="text-sm text-slate-700">Data</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="date"
                className="border rounded-xl px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                onClick={load}
                className="h-10 px-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                Aplicar
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-700">Busca</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2"
              placeholder="Cliente, tipo, nº doc…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-slate-700">Status da conferência</label>
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2"
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus((e.target.value as StatusConferencia) || "")
              }
            >
              <option value="">(todos)</option>
              <option value="PENDENTE">PENDENTE</option>
              <option value="CONFIRMADO">CONFIRMADO</option>
              <option value="DIVERGENTE">DIVERGENTE</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <div className="text-sm text-slate-700 mb-1">Origem</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowLanc((v) => !v)}
                className={`px-3 py-2 rounded-xl border text-sm ${
                  showLanc ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                }`}
              >
                Lançamentos
              </button>
              <button
                onClick={() => setShowTitulos((v) => !v)}
                className={`px-3 py-2 rounded-xl border text-sm ${
                  showTitulos ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                }`}
              >
                Títulos
              </button>
              <button
                onClick={() => setShowBaixas((v) => !v)}
                className={`px-3 py-2 rounded-xl border text-sm ${
                  showBaixas ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                }`}
              >
                Baixas
              </button>
              <label className="ml-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={hideConfirmados}
                  onChange={(e) => setHideConfirmados(e.target.checked)}
                />
                Ocultar confirmados
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Resumos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-900 p-4">
          <div className="text-xs opacity-70">Pendentes</div>
          <div className="text-2xl font-semibold">
            {itens
              .filter((r) => r.status_conferencia !== "CONFIRMADO")
              .reduce((a, r) => a + (r.valor || 0), 0)
              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-800 p-4">
          <div className="text-xs opacity-70">Confirmados</div>
          <div className="text-2xl font-semibold">
            {itens
              .filter((r) => r.status_conferencia === "CONFIRMADO")
              .reduce((a, r) => a + (r.valor || 0), 0)
              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-rose-50 to-red-50 text-rose-800 p-4">
          <div className="text-xs opacity-70">Divergentes</div>
          <div className="text-2xl font-semibold">
            {itens
              .filter((r) => r.status_conferencia === "DIVERGENTE")
              .reduce((a, r) => a + (r.valor || 0), 0)
              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs opacity-70">Resumo por tipo (dia)</div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[13px]">
            {Object.entries(resumo).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="truncate text-slate-600">{k}</span>
                <span className="font-medium">
                  {BRL(Number(v))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barra de ações em massa */}
      <div className="rounded-2xl border bg-white p-3 shadow-sm flex flex-wrap items-center gap-3">
        <div className="text-sm text-slate-700">
          <span className="font-semibold">{filtered.length}</span> lançamentos
          visíveis ·
          <span className="ml-1">
            Total visível: <span className="font-semibold">{BRL(totals.visivel)}</span>
          </span>
          {selectedCount > 0 && (
            <>
              <span className="mx-2">|</span>
              <span className="text-slate-700">
                Selecionados: <span className="font-semibold">{selectedCount}</span> ·{" "}
                <span className="font-semibold">{BRL(totals.selecionado)}</span>
              </span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleSelectAllVisible}
            className="px-3 py-2 rounded-xl border hover:bg-slate-50 text-sm"
          >
            {allVisibleSelected ? "Limpar seleção" : "Selecionar visíveis"}
          </button>
          <button
            disabled={selectedCount === 0}
            onClick={() =>
              doConfirmar(filtered.filter((r) => selected.has(keyOf(r))))
            }
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm"
          >
            Confirmar selecionados
          </button>
          <button
            disabled={selectedCount === 0}
            onClick={() => setDivModalOpen(true)}
            className="px-3 py-2 rounded-xl border text-rose-700 hover:bg-rose-50 disabled:opacity-50 text-sm"
          >
            Marcar divergente…
          </button>
          <button
            disabled={selectedCount === 0}
            onClick={() =>
              doDesfazer(filtered.filter((r) => selected.has(keyOf(r))))
            }
            className="px-3 py-2 rounded-xl border hover:bg-slate-50 disabled:opacity-50 text-sm"
          >
            Desfazer
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/90 backdrop-blur sticky top-0 border-b">
            <tr>
              <th className="p-2 border">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
              </th>
              <th className="p-2 border text-left">Cliente</th>
              <th className="p-2 border text-left">Tipo</th>
              <th className="p-2 border text-left">Nº Doc</th>
              <th className="p-2 border text-left">Bom para</th>
              <th className="p-2 border text-right">Valor</th>
              <th className="p-2 border text-left">Conf.</th>
              <th className="p-2 border text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-6 text-center" colSpan={8}>
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  className="p-6 text-center text-slate-500"
                  colSpan={8}
                >
                  Sem lançamentos
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const selectedRow = selected.has(keyOf(r));
              const rowBg = rowBgByValor(Number(r.valor ?? 0));
              return (
                <tr
                  key={`${r.id}-${r.origem}-${r.origem_id}`}
                  className={`border-t ${rowBg} ${selectedRow ? "bg-blue-50/40" : ""}`}
                >
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={selectedRow}
                      onChange={() => toggleOne(r)}
                    />
                  </td>
                  <td className="p-2 border min-w-[220px]">
                    <div className="font-medium">
                      {getClientName(
                        r.cliente_id,
                        r.cliente_nome || undefined
                      )}
                    </div>
                    <div className="text-xs text-slate-500">#{r.cliente_id}</div>
                  </td>
                  <td className="p-2 border">{r.tipo}</td>
                  <td className="p-2 border">{r.numero_doc || "-"}</td>
                  <td className="p-2 border">{DATE(r.bom_para)}</td>
                  <td className="p-2 border text-right font-medium">
                    {BRL(r.valor)}
                  </td>
                  <td className="p-2 border">
                    <StatusPill value={r.status_conferencia || "PENDENTE"} />
                  </td>
                  <td className="p-2 border">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => doConfirmar([r])}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Confirmar"
                        aria-label="Confirmar"
                      >
                        <IconCheck size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(new Set([keyOf(r)]));
                          setDivModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border text-rose-700 hover:bg-rose-50"
                        title="Divergir"
                        aria-label="Divergir"
                      >
                        <IconAlert size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => doDesfazer([r])}
                        className="p-1.5 rounded-lg border hover:bg-slate-50"
                        title="Desfazer"
                        aria-label="Desfazer"
                      >
                        <IconUndo size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal divergência */}
      {divModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setDivModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold">Marcar como divergente</h4>
              <button
                className="rounded-md border px-2 py-1 text-sm"
                onClick={() => setDivModalOpen(false)}
              >
                Fechar
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-700">
                  Comentário (obrigatório)
                </label>
                <textarea
                  value={divComentario}
                  onChange={(e) => setDivComentario(e.target.value)}
                  className="mt-1 w-full h-28 border rounded-xl px-3 py-2"
                  placeholder="Ex.: PIX não localizado no extrato"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="px-3 py-2 rounded-xl border"
                  onClick={() => setDivModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                  disabled={!divComentario.trim() || selectedCount === 0}
                  onClick={() =>
                    doDivergir(
                      filtered.filter((r) => selected.has(keyOf(r))),
                      divComentario.trim()
                    )
                  }
                >
                  Marcar divergente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Erro inline */}
      {err && (
        <div className="rounded-xl border bg-rose-50 text-rose-800 p-3">
          {err}
        </div>
      )}
    </div>
  );
}
