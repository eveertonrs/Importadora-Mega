// src/components/Home.tsx
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../services/api";

// 👉 se você tiver esse hook, mantenha; se não, pode apagar a linha sem problemas
import { /* useAuth */ } from "../contexts/AuthContext";

import Button from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Badge from "./ui/badge";

/** ======================= types & helpers ======================= */
type BlocoItem = {
  id: number;
  codigo: string;
  cliente?: string;
  status: "ABERTO" | "FECHADO";
  aberto_em?: string;
};

type SaldosBloco = {
  saldo_bloco?: number;
  saldo?: number;
  saldo_total?: number;
  saldoDoBloco?: number;
  a_receber?: number;
  aReceber?: number;
  em_aberto?: number;
  emAberto?: number;
};

const currency = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function extractTotal(resp: any): number {
  const h = resp?.headers;
  const fromHeader = h?.["x-total-count"] ?? h?.["X-Total-Count"];
  if (fromHeader) return Number(fromHeader) || 0;
  const d = resp?.data;
  if (d && typeof d.total === "number") return d.total;
  if (d && typeof d.count === "number") return d.count;
  return Array.isArray(d) ? d.length : 0;
}

const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : undefined;

const safeNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function pickNumber(o: any, ...aliases: string[]) {
  for (const k of aliases) {
    if (o && Object.prototype.hasOwnProperty.call(o, k)) {
      const n = safeNumber(o[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/** ======================= UI base ======================= */

function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

function MetricCard(props: {
  title: string;
  value: React.ReactNode;
  linkTo?: string;
  linkText?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  "aria-live"?: "polite" | "assertive" | "off";
  tooltip?: string;
}) {
  const { title, value, linkTo, linkText = "ver", icon, loading, tooltip, ...a11y } = props;
  return (
    <Card aria-busy={loading} className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-500 flex items-center gap-2">
          {icon && <span aria-hidden className="text-lg">{icon}</span>}
          <span title={tooltip}>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between pb-5">
        <div className="min-h-[56px] sm:min-h-[64px] flex items-end overflow-visible" {...a11y}>
          {loading ? (
            <div className="w-32">
              <SkeletonBox className="h-8 w-full" />
            </div>
          ) : (
            <div className="font-extrabold leading-none tracking-tight break-words text-[clamp(1.25rem,2.6vw,2rem)]">
              {value}
            </div>
          )}
        </div>
        {linkTo && (
          <Link to={linkTo} className="text-blue-600 hover:underline text-sm">
            {linkText}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}


/** ======== Charts ======== */

function BarsChart({
  data,
  width = 420,
  height = 110,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const maxAbs = Math.max(1, ...data.map((v) => Math.abs(v)));
  const midY = height / 2;
  const barW = Math.max(6, Math.floor((width - 24) / data.length) - 8);
  return (
    <svg width={width} height={height} className="block">
      <line x1="0" y1={midY} x2={width} y2={midY} stroke="#e2e8f0" />
      {data.map((v, i) => {
        const x = 12 + i * (barW + 8);
        const h = (Math.abs(v) / maxAbs) * (height / 2 - 10);
        const isPos = v >= 0;
        const y = isPos ? midY - h : midY;
        const fill = isPos ? "#10b981" : "#ef4444";
        return <rect key={i} x={x} y={y} width={barW} height={h} rx="3" fill={fill} opacity="0.9" />;
      })}
    </svg>
  );
}

function DonutChart({
  a,
  b,
  size = 180,
  labels = ["Débito blocos", "A receber"],
}: {
  a: number;
  b: number;
  size?: number;
  labels?: [string, string] | string[];
}) {
  const total = Math.max(0, a) + Math.max(0, b);
  const r = size / 2;
  const stroke = 18;
  const radius = r - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const aLen = total ? (Math.max(0, a) / total) * circumference : 0;
  const bLen = total ? (Math.max(0, b) / total) * circumference : 0;
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle cx={r} cy={r} r={radius} stroke="#ef4444" strokeWidth={stroke} fill="none"
          strokeDasharray={`${aLen} ${circumference - aLen}`} strokeDashoffset={circumference * 0.25}/>
        <circle cx={r} cy={r} r={radius} stroke="#f59e0b" strokeWidth={stroke} fill="none"
          strokeDasharray={`${bLen} ${circumference - bLen}`} strokeDashoffset={circumference * 0.25 - aLen}/>
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="14" fill="#334155">
          {currency(total)}
        </text>
      </svg>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#ef4444" }} />
          <span className="text-slate-600">{labels[0]}:</span>
          <strong className="text-slate-800">{currency(a)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#f59e0b" }} />
          <span className="text-slate-600">{labels[1]}:</span>
          <strong className="text-slate-800">{currency(b)}</strong>
        </div>
        <div className="pt-1 text-xs text-slate-500">
          Total = {currency(total)} (bate com “Financeiro (abertos)”)
        </div>
      </div>
    </div>
  );
}

/** ======================= página ======================= */

export default function Home() {
  const navigate = useNavigate();

  // ===== papel do usuário (admin x administrativo)
  // Se você já tiver um hook, descomente e use:
  // const { user } = useAuth();
  const role: string | undefined = useMemo(() => {
    try {
      // tenta diferentes formatos comuns no localStorage
      const keys = ["auth_user", "auth", "user", "megafin:auth"];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (obj?.user?.permissao) return String(obj.user.permissao);
        if (obj?.permissao) return String(obj.permissao);
      }
    } catch {}
    return undefined;
  }, []);
  const isAdmin = role === "admin";

  const [clientesTotal, setClientesTotal] = useState<number>(0);
  const [blocosAbertosTotal, setBlocosAbertosTotal] = useState<number>(0);

  const [saldoBlocoTotal, setSaldoBlocoTotal] = useState<number>(0);
  const [debitoBlocoTotal, setDebitoBlocoTotal] = useState<number>(0); // |saldo negativo|
  const [financeiroTotal, setFinanceiroTotal] = useState<number>(0);   // débito + a receber
  const [aReceberTotal, setAReceberTotal] = useState<number>(0);

  const [blocosRecentes, setBlocosRecentes] = useState<BlocoItem[]>([]);
  const [bars, setBars] = useState<number[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  /** ====== data ====== */

  async function fetchAllBlocosAbertos(limit = 50): Promise<any[]> {
    let page = 1;
    let total = 0;
    const all: any[] = [];
    const first = await api.get("/blocos", {
      params: { status: "ABERTO", page, limit, sortBy: "aberto_em", sortDir: "DESC" },
    });
    total = extractTotal(first);
    all.push(...(first.data?.data ?? first.data ?? []));
    const pages = Math.ceil(total / limit);
    while (page < pages) {
      page += 1;
      const r = await api.get("/blocos", {
        params: { status: "ABERTO", page, limit, sortBy: "aberto_em", sortDir: "DESC" },
        headers: { "x-silent": "1" },
      });
      all.push(...(r.data?.data ?? r.data ?? []));
    }
    const recentes = (all.slice(0, 5) as any[]).map((b) => ({
      id: b.id,
      codigo: b.codigo,
      cliente: b.cliente_nome ?? b.cliente?.nome_fantasia ?? b.cliente ?? "",
      status: b.status,
      aberto_em: formatDateTime(b.aberto_em),
    })) as BlocoItem[];
    setBlocosRecentes(recentes);
    setBlocosAbertosTotal(total || all.length);
    return all;
  }

  type Row = { blocoId: number; saldoBloco: number; aReceber: number; exposicao: number };

  async function fetchFinanceiroRows(blocosAbertos: any[]): Promise<Row[]> {
    const saldosResp = await Promise.allSettled(
      blocosAbertos.map((b: any) => api.get(`/blocos/${b.id}/saldos`, { headers: { "x-silent": "1" } }))
    );
    const rows: Row[] = [];
    saldosResp.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const raw = (r.value?.data ?? {}) as SaldosBloco;
      const saldoBloco = pickNumber(raw, "saldo_bloco", "saldoDoBloco", "saldo_total", "saldo");
      const aReceberBloco = pickNumber(raw, "a_receber", "aReceber", "em_aberto", "emAberto");
      const exposicao = Math.max(0, -saldoBloco) + aReceberBloco;
      rows.push({ blocoId: blocosAbertos[i].id, saldoBloco, aReceber: aReceberBloco, exposicao });
    });
    return rows;
  }

  async function fetchAReceberTotal(): Promise<number> {
    try {
      const r = await api.get("/financeiro/receber/resumo", {
        params: { status: "ABERTO,PARCIAL" },
        headers: { "x-silent": "1" },
      });
      const v = pickNumber(r.data, "a_receber", "aReceber", "total", "valor", "valor_total") || 0;
      if (v > 0) return v;
    } catch {}
    // fallbacks por paginação (se não existir /resumo)
    async function sumFrom(path: string): Promise<number> {
      const limit = 100;
      let page = 1;
      let soma = 0;
      const sumPage = (resp: any) => {
        const rows = resp?.data?.data ?? resp?.data ?? [];
        for (const it of rows) {
          const pronto = pickNumber(it, "em_aberto", "emAberto", "a_receber", "aReceber");
          if (pronto) { soma += pronto; continue; }
          const bruto = pickNumber(it, "valor_bruto", "valorBruto", "valor");
          const baixado = pickNumber(it, "valor_baixado", "valorBaixado", "baixado");
          soma += Math.max(0, bruto - baixado);
        }
      };
      const first = await api.get(path, { params: { page, limit, status: "ABERTO,PARCIAL" }, headers: { "x-silent": "1" } });
      const total = extractTotal(first);
      sumPage(first);
      const pages = Math.ceil(total / limit);
      for (let p = 2; p <= pages; p++) {
        const resp = await api.get(path, { params: { page: p, limit, status: "ABERTO,PARCIAL" }, headers: { "x-silent": "1" } });
        sumPage(resp);
      }
      return soma;
    }
    try { const v = await sumFrom("/financeiro/receber"); if (v > 0) return v; } catch {}
    try { const v = await sumFrom("/financeiro/titulos"); if (v > 0) return v; } catch {}
    return 0;
  }

  const carregarDashboard = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const respClientes = await api.get("/clientes", { params: { page: 1, limit: 1 } });
      setClientesTotal(extractTotal(respClientes));

      const blocosAbertos = await fetchAllBlocosAbertos(50);
      const [rows, totalARec] = await Promise.all([
        fetchFinanceiroRows(blocosAbertos),
        fetchAReceberTotal(),
      ]);
      setAReceberTotal(totalARec);

      const totalSaldoBloco = rows.reduce((sum, r) => sum + r.saldoBloco, 0);
      const totalDebito = rows.reduce((sum, r) => sum + Math.max(0, -r.saldoBloco), 0);

      setSaldoBlocoTotal(totalSaldoBloco);
      setDebitoBlocoTotal(totalDebito);
      setFinanceiroTotal(totalDebito + totalARec);

      const top5 = rows.slice().sort((a, b) => Math.abs(b.exposicao) - Math.abs(a.exposicao))
        .slice(0, 5).map((r) => r.exposicao);
      setBars(top5);
    } catch (e: any) {
      console.error("Erro no dashboard:", e);
      const msg = e?.response?.data?.message || e?.message || "Falha ao carregar o dashboard.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDashboard(); }, [carregarDashboard]);

  const resumo = useMemo(
    () => ({
      clientes: clientesTotal,
      blocosAbertos: blocosAbertosTotal,
      saldoBlocoTotal,
      financeiroTotal,
      aReceberTotal,
      debitoBlocoTotal,
    }),
    [clientesTotal, blocosAbertosTotal, saldoBlocoTotal, financeiroTotal, aReceberTotal, debitoBlocoTotal]
  );

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white px-6 py-6 shadow-md">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo</h2>
            <p className="mt-1 text-slate-300">
              {isAdmin ? "Visão geral do financeiro e acessos rápidos."
                       : "Visão geral dos blocos e acessos rápidos."}
            </p>
          </div>
          <div className="flex gap-3" />
        </div>
      </section>

      {/* erro */}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 flex items-center justify-between gap-3">
          <span>{err}</span>
          <Button variant="outline" onClick={carregarDashboard}>Tentar novamente</Button>
        </div>
      )}

      {/* métricas */}
      <section className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <MetricCard
          title="Clientes"
          icon="👥"
          loading={loading}
          value={<p className="text-3xl md:text-4xl font-bold whitespace-nowrap">{resumo.clientes}</p>}
          linkTo="/clientes"
          linkText="Ver clientes"
          aria-live="polite"
        />

        <MetricCard
          title="Blocos abertos"
          icon="🧩"
          loading={loading}
          value={<p className="text-3xl md:text-4xl font-bold whitespace-nowrap">{resumo.blocosAbertos}</p>}
          linkTo="/blocos"
          linkText="Ver blocos"
          aria-live="polite"
        />

        <MetricCard
          title="Saldo do bloco (abertos)"
          icon="📊"
          loading={loading}
          value={
            <span className={saldoBlocoTotal < 0 ? "text-rose-600" : "text-emerald-600"}>
              {currency(saldoBlocoTotal)}
            </span>
          }
        />

        {/* ===== ADMIN-ONLY ===== */}
        {isAdmin && (
          <>
            <MetricCard
              title="Financeiro (abertos)"
              icon="💰"
              loading={loading}
              tooltip="Débito dos blocos (|saldo negativo|) + A receber (abertos)."
              value={<span className="text-emerald-600">{currency(resumo.financeiroTotal)}</span>}
            />
            <MetricCard
              title="A receber (abertos)"
              icon="📥"
              loading={loading}
              value={<span className="text-amber-700">{currency(resumo.aReceberTotal)}</span>}
            />
          </>
        )}
      </section>

      {/* ===== ADMIN-ONLY: Composição do financeiro ===== */}
      {isAdmin && (
        <section>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-600">Composição do financeiro (abertos)</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {loading ? <SkeletonBox className="h-44 w-full" /> :
                <DonutChart a={resumo.debitoBlocoTotal} b={resumo.aReceberTotal} />}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ===== ADMIN-ONLY: Top 5 por exposição ===== */}
      {isAdmin && (
        <section>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-600">Top 5 blocos por exposição (financeiro)</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {loading ? <SkeletonBox className="h-28 w-full" /> :
                (bars.length ? (
                  <div className="overflow-x-auto">
                    <BarsChart data={bars} />
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-emerald-500" /> positivo
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded bg-rose-500" /> negativo
                      </span>
                    </div>
                  </div>
                ) : <div className="text-slate-500">Sem dados para exibir.</div>)}
            </CardContent>
          </Card>
        </section>
      )}

      {/* blocos recentes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Blocos abertos (recentes)</h3>
          <Link to="/blocos" className="text-sm text-blue-600 hover:underline">ver todos</Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Aberto em</th>
                    <th className="w-28 px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-b last:border-0">
                      <td className="px-4 py-3"><SkeletonBox className="h-4 w-48" /></td>
                      <td className="px-4 py-3"><SkeletonBox className="h-6 w-20 rounded-full" /></td>
                      <td className="px-4 py-3"><SkeletonBox className="h-4 w-36" /></td>
                      <td className="px-4 py-3"><SkeletonBox className="h-4 w-14" /></td>
                    </tr>
                  ))}
                  {!loading && blocosRecentes.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">{b.cliente ?? "-"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={b.status === "ABERTO" ? "success" : "neutral"}>{b.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.aberto_em ?? "-"}</td>
                      <td className="px-4 py-3">
                        <Link to={`/blocos/${b.id}`} className="text-blue-600 hover:underline">Abrir</Link>
                      </td>
                    </tr>
                  ))}
                  {!loading && blocosRecentes.length === 0 && (
                    <tr><td className="px-4 py-6 text-slate-500" colSpan={6}>Nenhum bloco aberto encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* mobile */}
            <div className="divide-y sm:hidden">
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <div key={`skm-${i}`} className="p-4 space-y-2">
                  <SkeletonBox className="h-4 w-40" />
                  <SkeletonBox className="h-4 w-24" />
                  <SkeletonBox className="h-8 w-20 rounded-md" />
                </div>
              ))}
              {!loading && blocosRecentes.map((b) => (
                <div key={b.id} className="p-4">
                  <div className="font-medium">{b.cliente ?? "-"}</div>
                  <div className="mt-1 text-sm text-slate-600">{b.aberto_em ?? "-"}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge tone={b.status === "ABERTO" ? "success" : "neutral"}>{b.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/blocos/${b.id}`)}>Abrir</Button>
                  </div>
                </div>
              ))}
              {!loading && blocosRecentes.length === 0 && (
                <div className="p-6 text-slate-500">Nenhum bloco aberto encontrado.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
