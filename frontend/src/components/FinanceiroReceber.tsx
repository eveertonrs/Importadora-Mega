// src/components/FinanceiroReceber.tsx
import { useEffect, useMemo, useState } from "react";
import { listarTitulos, estornarTitulo, type Titulo } from "../services/financeiro";
import BaixaModal from "./financeiro/BaixaModal";
import StatusBadge from "./ui/StatusBadge";
import { ensureClientNames, getClientName } from "../utils/clientNameCache";

const money = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const initials = (name: string) =>
  (name || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");

// diferença em dias entre bom_para e hoje (positivo = futuro; 0 = hoje; negativo = atraso)
function daysToDue(date?: string | null): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const d = new Date(date);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000); // <-- divide antes, depois arredonda
}

function dueBadge(date?: string | null) {
  if (!date) return <span className="text-slate-400">—</span>;
  const diff = Math.round(daysToDue(date));
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
        Hoje
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200">
        {Math.abs(diff)} dia{Math.abs(diff) > 1 ? "s" : ""} em atraso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
      D-{diff}
    </span>
  );
}

type PrazoFiltro = "ALL" | "D0" | "D1" | "D2" | "D3" | "ATE7" | "ATRASO" | "SEM_DATA";
type TipoFiltro = "all" | "BOLETO" | "CHEQUE";
type Ordenar = "BOM_PARA_ASC" | "BOM_PARA_DESC" | "DIAS_ASC" | "PENDENTE_DESC";

export default function FinanceiroReceber() {
  const [items, setItems] = useState<Titulo[]>([]);
  const [loading, setLoading] = useState(false);

  // FILTROS (servidor)
  const [status, setStatus] = useState<"ABERTO" | "PARCIAL" | "BAIXADO" | "all" | "ABERTO,PARCIAL">("ABERTO,PARCIAL");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [q, setQ] = useState("");

  // FILTROS (cliente)
  const [prazo, setPrazo] = useState<PrazoFiltro>("ALL");
  const [tipo, setTipo] = useState<TipoFiltro>("all");
  const [ordenar, setOrdenar] = useState<Ordenar>("BOM_PARA_ASC");

  // BAIXA
  const [showBaixa, setShowBaixa] = useState(false);
  const [tituloSel, setTituloSel] = useState<{ id: number; pendente: number } | null>(null);

  async function load(override?: { status?: string; from?: string; to?: string; q?: string }) {
    setLoading(true);
    try {
      const resp = await listarTitulos({
        status: (override?.status ?? status) === "all" ? undefined : (override?.status ?? status),
        from: override?.from ?? (from || undefined),
        to: override?.to ?? (to || undefined),
        q: override?.q ?? (q || undefined),
        pageSize: 500,
      });

      const list = (resp.data ?? []) as Titulo[];

      // garantir nome dos clientes (cache)
      const ids = Array.from(new Set(list.map((t) => Number(t.cliente_id)).filter(Boolean)));
      await ensureClientNames(ids);

      setItems(
        list.map((t) => ({
          ...t,
          cliente_nome: getClientName(t.cliente_id as any, (t as any).cliente_nome),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  // 1ª carga
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-recarregar quando trocar o STATUS (chips)
  useEffect(() => {
    load({ status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // totais (sobre a lista carregada)
  const totalAberto = useMemo(
    () => items.reduce((acc, t) => acc + Math.max(0, t.valor_bruto - t.valor_baixado), 0),
    [items]
  );
  const totalHoje = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items
      .filter((t) => t.bom_para?.slice(0, 10) === today && t.status !== "BAIXADO")
      .reduce((acc, t) => acc + Math.max(0, t.valor_bruto - t.valor_baixado), 0);
  }, [items]);
  const totalAtraso = useMemo(
    () =>
      items
        .filter((t) => daysToDue(t.bom_para) < 0 && t.status !== "BAIXADO")
        .reduce((acc, t) => acc + Math.max(0, t.valor_bruto - t.valor_baixado), 0),
    [items]
  );
  const totalBaixadoPeriodo = useMemo(
    () => items.reduce((acc, t) => acc + Number(t.valor_baixado || 0), 0),
    [items]
  );

  // lista filtrada + ordenada (client side)
  const viewItems = useMemo(() => {
    const getPendente = (t: Titulo) => Math.max(0, t.valor_bruto - t.valor_baixado);

    let list = [...items];
    if (tipo !== "all") list = list.filter((t) => t.tipo === tipo);

    if (prazo !== "ALL") {
      list = list.filter((t) => {
        const d = Math.round(daysToDue(t.bom_para));
        switch (prazo) {
          case "D0": return d === 0;
          case "D1": return d === 1;
          case "D2": return d === 2;
          case "D3": return d === 3;
          case "ATE7": return d >= 0 && d <= 7;
          case "ATRASO": return d < 0 && t.status !== "BAIXADO";
          case "SEM_DATA": return !t.bom_para;
          default: return true;
        }
      });
    }

    list.sort((a, b) => {
      const aDias = Math.round(daysToDue(a.bom_para));
      const bDias = Math.round(daysToDue(b.bom_para));
      const aTime = a.bom_para ? new Date(a.bom_para).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.bom_para ? new Date(b.bom_para).getTime() : Number.POSITIVE_INFINITY;
      const aPend = getPendente(a);
      const bPend = getPendente(b);

      if (ordenar === "BOM_PARA_ASC") {
        if (aTime !== bTime) return aTime - bTime;
        if (aPend !== bPend) return bPend - aPend;
        return String(a.cliente_nome ?? "").localeCompare(String(b.cliente_nome ?? ""));
      }
      if (ordenar === "BOM_PARA_DESC") {
        if (aTime !== bTime) return bTime - aTime;
        if (aPend !== bPend) return bPend - aPend;
        return String(a.cliente_nome ?? "").localeCompare(String(b.cliente_nome ?? ""));
      }
      if (ordenar === "DIAS_ASC") {
        if (aDias !== bDias) return aDias - bDias;
        if (aPend !== bPend) return bPend - aPend;
        return String(a.cliente_nome ?? "").localeCompare(String(b.cliente_nome ?? ""));
      }
      if (ordenar === "PENDENTE_DESC") {
        if (aPend !== bPend) return bPend - aPend;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.cliente_nome ?? "").localeCompare(String(b.cliente_nome ?? ""));
      }
      return 0;
    });

    return list;
  }, [items, prazo, tipo, ordenar]);

  async function handleEstornar(id: number) {
    const ok = window.confirm("Confirmar estorno deste título? Ele voltará para 'A receber'.");
    if (!ok) return;
    await estornarTitulo(id);
    await load();
  }

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Contas a Receber</h1>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardResumo label="A receber" value={money(totalAberto)} tone="rose" />
        <CardResumo label="Vencem hoje" value={money(totalHoje)} tone="amber" />
        <CardResumo label="Em atraso" value={money(totalAtraso)} tone="red" />
        <CardResumo label="Baixado no período" value={money(totalBaixadoPeriodo)} tone="emerald" />
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border bg-white p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* STATUS (servidor) */}
          <div className="flex items-center gap-1">
            {[
              // { v: "ABERTO,PARCIAL", label: "Abertos + Parciais" },
              { v: "ABERTO", label: "Abertos" },
              // { v: "PARCIAL", label: "Apenas parciais" },
              { v: "BAIXADO", label: "Baixados" },
              { v: "all", label: "Todos" },
            ].map((s) => (
              <button
                key={s.v}
                onClick={() => setStatus(s.v as any)}
                className={[
                  "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
                  status === (s.v as any)
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="text-sm">
            <span className="block text-slate-600">De</span>
            <input
              type="date"
              className="mt-1 rounded-lg border px-3 py-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>

          <label className="text-sm">
            <span className="block text-slate-600">Até</span>
            <input
              type="date"
              className="mt-1 rounded-lg border px-3 py-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>

          <label className="flex-1 text-sm min-w-[220px]">
            <span className="block text-slate-600">Busca rápida</span>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="nº doc, observação…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            />
          </label>

          <button onClick={() => load()} className="h-10 rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700">
            Aplicar
          </button>

          <div className="ml-auto text-sm">
            <span className="font-medium">A receber: </span>
            <span className="font-semibold text-rose-600">{money(totalAberto)}</span>
          </div>
        </div>

        {/* Linha 2: Prazo / Tipo / Ordenar (client side) */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-sm text-slate-600">Prazo:</span>
            {(
              [
                { v: "ALL", label: "Todos" },
                { v: "D0", label: "Hoje (D-0)" },
                { v: "D1", label: "D-1" },
                { v: "D2", label: "D-2" },
                { v: "D3", label: "D-3" },
                { v: "ATE7", label: "Até 7 dias" },
                { v: "ATRASO", label: "Atrasados" },
                { v: "SEM_DATA", label: "Sem data" },
              ] as const
            ).map((p) => (
              <button
                key={p.v}
                onClick={() => setPrazo(p.v)}
                className={[
                  "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
                  prazo === p.v
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="ml-1 mr-1 text-sm text-slate-600">Tipo:</span>
            {(
              [
                { v: "all", label: "Todos" },
                { v: "BOLETO", label: "Boletos" },
                { v: "CHEQUE", label: "Cheques" },
              ] as const
            ).map((p) => (
              <button
                key={p.v}
                onClick={() => setTipo(p.v)}
                className={[
                  "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
                  tipo === p.v
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="text-sm">
            <span className="block text-slate-600">Ordenar por</span>
            <select
              className="mt-1 rounded-lg border px-3 py-2"
              value={ordenar}
              onChange={(e) => setOrdenar(e.target.value as Ordenar)}
            >
              <option value="BOM_PARA_ASC">Bom para (mais cedo → mais tarde)</option>
              <option value="BOM_PARA_DESC">Bom para (mais tarde → mais cedo)</option>
              <option value="DIAS_ASC">Dias (D-1, D-2, D-3… crescente)</option>
              <option value="PENDENTE_DESC">Valor pendente (maior → menor)</option>
            </select>
          </label>
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left">
              <th className="p-2 border">Cliente</th>
              <th className="p-2 border">Tipo</th>
              <th className="p-2 border">Nº Doc</th>
              <th className="p-2 border">Bom para</th>
              <th className="p-2 border text-right">Valor</th>
              <th className="p-2 border text-right">Baixado</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border w-28">Ações</th>
            </tr>
          </thead>

        <tbody className="[&>tr:nth-child(even)]:bg-slate-50/40">
          {loading && (
            <tr><td colSpan={8} className="p-6 text-center">Carregando…</td></tr>
          )}

          {!loading && viewItems.length === 0 && (
            <tr><td colSpan={8} className="p-8 text-center text-slate-500">Sem títulos</td></tr>
          )}

          {!loading && viewItems.map((t) => {
            const pendente = Math.max(0, t.valor_bruto - t.valor_baixado);
            const name = getClientName(t.cliente_id as any, (t as any).cliente_nome);
            return (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="p-2 border">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                      {initials(name)}
                    </div>
                    <div className="truncate" title={name}>
                      <div className="truncate font-medium">{name}</div>
                    </div>
                  </div>
                </td>

                <td className="p-2 border">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {t.tipo === "BOLETO" ? "🧾" : t.tipo === "CHEQUE" ? "💳" : "📄"} {t.tipo}
                  </span>
                </td>

                <td className="p-2 border">{t.numero_doc || "—"}</td>

                <td className="p-2 border">
                  <div className="flex items-center gap-2">
                    <span>{t.bom_para ? new Date(t.bom_para).toLocaleDateString() : "—"}</span>
                    {dueBadge(t.bom_para)}
                  </div>
                </td>

                <td className="p-2 border text-right whitespace-nowrap">{money(t.valor_bruto)}</td>
                <td className="p-2 border text-right whitespace-nowrap">{money(t.valor_baixado)}</td>

                <td className="p-2 border"><StatusBadge value={t.status} /></td>

                <td className="p-2 border">
                  {t.status === "BAIXADO" ? (
                    <button
                      className="w-full rounded-md border border-rose-600 bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400/50 transition-colors"
                      onClick={() => handleEstornar(t.id)}
                    >
                      Estornar
                    </button>
                  ) : pendente > 0 ? (
                    <button
                      className="w-full rounded-md border border-emerald-600 bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-colors"
                      onClick={() => {
                        setTituloSel({ id: t.id, pendente });
                        setShowBaixa(true);
                      }}
                    >
                      Baixar
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>

              </tr>
            );
          })}
        </tbody>

        {!loading && viewItems.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100/60">
              <td className="p-2 border font-medium text-right" colSpan={4}>Totais (lista exibida):</td>
              <td className="p-2 border font-semibold text-right">
                {money(viewItems.reduce((a, t) => a + t.valor_bruto, 0))}
              </td>
              <td className="p-2 border font-semibold text-right">
                {money(viewItems.reduce((a, t) => a + t.valor_baixado, 0))}
              </td>
              <td className="p-2 border" colSpan={2}></td>
            </tr>
          </tfoot>
        )}
        </table>
      </div>

      {showBaixa && tituloSel && (
        <BaixaModal
          open={showBaixa}
          onClose={() => setShowBaixa(false)}
          tituloId={tituloSel.id}
          pendente={tituloSel.pendente}
          onDone={() => load()}
        />
      )}
    </div>
  );
}

function CardResumo({
  label, value, tone,
}: { label: string; value: string; tone: "rose" | "amber" | "red" | "emerald"; }) {
  const cls =
    tone === "amber" ? "from-amber-50 to-white ring-amber-200 text-amber-900"
    : tone === "red" ? "from-rose-50 to-white ring-rose-200 text-rose-900"
    : tone === "emerald" ? "from-emerald-50 to-white ring-emerald-200 text-emerald-900"
    : "from-rose-50 to-white ring-rose-200 text-rose-900";
  return (
    <div className={`rounded-2xl bg-gradient-to-br px-4 py-3 ring-1 ${cls} shadow-sm`}>
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
