// src/components/Home.tsx
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../services/api";

import Button from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Badge from "./ui/badge";

/** ======================= helpers ======================= */
type BlocoItem = {
  id: number;
  codigo: string;
  cliente?: string;
  status: "ABERTO" | "FECHADO";
  aberto_em?: string;
};

const currency = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// tenta extrair total do body (total|count) ou do header x-total-count
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

/** ======================= pequenos componentes ======================= */

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
        <div className="min-h-[40px]" {...a11y}>
          {loading ? <SkeletonBox className="h-8 w-32" /> : value}
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

function Shortcut({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      onClick={() => navigate(to)}
      className="flex items-center gap-2 px-3"
      title={label}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </Button>
  );
}

/** ======================= página ======================= */

export default function Home() {
  const navigate = useNavigate();

  const [clientesTotal, setClientesTotal] = useState<number>(0);
  const [blocosAbertosTotal, setBlocosAbertosTotal] = useState<number>(0);
  const [saldoTop5, setSaldoTop5] = useState<number>(0); // saldo imediato (ignora bom_para)
  const [blocosRecentes, setBlocosRecentes] = useState<BlocoItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const carregarDashboard = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) total de clientes (usa paginação para obter o total)
      const respClientes = await api.get("/clientes", { params: { page: 1, limit: 1 } });
      setClientesTotal(extractTotal(respClientes));

      // 2) blocos abertos recentes (limit 5) e total de abertos
      const respBlocos = await api.get("/blocos", {
        params: { status: "ABERTO", page: 1, limit: 5, sortBy: "aberto_em", sortDir: "DESC" },
      });

      const lista: BlocoItem[] = (respBlocos.data?.data ?? respBlocos.data ?? []).map((b: any) => ({
        id: b.id,
        codigo: b.codigo,
        cliente: b.cliente_nome ?? b.cliente?.nome_fantasia ?? b.cliente ?? "",
        status: b.status,
        aberto_em: formatDateTime(b.aberto_em),
      }));

      setBlocosRecentes(lista);
      setBlocosAbertosTotal(extractTotal(respBlocos));

      // 3) saldo imediato dos top 5 (IGNORA bom_para).
      // Usa o endpoint novo /blocos/:id/saldos -> { saldo, a_receber }
      const saldosResp = await Promise.all(
        lista.map((b) => api.get(`/blocos/${b.id}/saldos`))
      );
      const somaSaldoImediato = saldosResp.reduce((acc, r) => {
        const raw = r?.data ?? {};
        const val = Number((raw as any).saldo ?? 0);
        return acc + (isFinite(val) ? val : 0);
      }, 0);
      setSaldoTop5(somaSaldoImediato);
    } catch (e: any) {
      console.error("Erro no dashboard:", e);
      const msg = e?.response?.data?.message || e?.message || "Falha ao carregar o dashboard.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [carregarDashboard]);

  const resumo = useMemo(
    () => ({ clientes: clientesTotal, blocosAbertos: blocosAbertosTotal, saldoTop5 }),
    [clientesTotal, blocosAbertosTotal, saldoTop5]
  );

  const saldoClass = resumo.saldoTop5 >= 0 ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white px-8 py-7 shadow-md">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo</h2>
            <p className="mt-1 text-slate-300">Visão geral do financeiro e acessos rápidos.</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="bg-white/10 text-white hover:bg-white/20 border-white/30"
              onClick={() => navigate("/blocos")}
            >
              Abrir blocos
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate("/financeiro/receber")}
            >
              Ir ao Financeiro
            </Button>
          </div>
        </div>
      </section>

      {/* erro com ação */}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 flex items-center justify-between gap-3">
          <span>{err}</span>
          <Button variant="outline" onClick={carregarDashboard}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* métricas */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MetricCard
          title="Clientes"
          icon="👥"
          loading={loading}
          value={<p className="text-4xl font-bold">{resumo.clientes}</p>}
          linkTo="/clientes"
          linkText="Ver clientes"
          aria-live="polite"
        />

        <MetricCard
          title="Blocos abertos"
          icon="🧩"
          loading={loading}
          value={<p className="text-4xl font-bold">{resumo.blocosAbertos}</p>}
          linkTo="/blocos"
          linkText="Ver blocos"
          aria-live="polite"
        />

        <MetricCard
          title="Saldo imediato (top 5 blocos)"
          icon="💰"
          loading={loading}
          tooltip="Somatório do saldo IMEDIATO dos 5 blocos mais recentes (ENTRADA – SAÍDA, ignorando lançamentos com 'bom_para')."
          value={
            <div>
              <p className={`text-4xl font-extrabold ${saldoClass}`}>{currency(resumo.saldoTop5)}</p>
              <p className="mt-1 text-xs text-slate-500">
                ENTRADA – SAÍDA (ignora 'bom_para')
              </p>
            </div>
          }
          aria-live="polite"
        />
      </section>

      {/* atalhos essenciais */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Acessos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Shortcut to="/blocos" label="Blocos" icon="🧩" />
            <Shortcut to="/clientes" label="Clientes" icon="👥" />
            <Shortcut to="/financeiro/receber" label="Financeiro" icon="💸" />
            <Shortcut to="/conferencia" label="Conferência" icon="✅" />
            <Shortcut to="/transportadoras" label="Transportadoras" icon="🚚" />
          </CardContent>
        </Card>
      </section>

      {/* blocos recentes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Blocos abertos (recentes)</h3>
          <Link to="/blocos" className="text-sm text-blue-600 hover:underline">
            ver todos
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            {/* Tabela desktop */}
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
                  {loading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={`sk-${i}`} className="border-b last:border-0">
                        <td className="px-4 py-3"><SkeletonBox className="h-4 w-48" /></td>
                        <td className="px-4 py-3"><SkeletonBox className="h-6 w-20 rounded-full" /></td>
                        <td className="px-4 py-3"><SkeletonBox className="h-4 w-36" /></td>
                        <td className="px-4 py-3"><SkeletonBox className="h-4 w-14" /></td>
                      </tr>
                    ))}

                  {!loading &&
                    blocosRecentes.map((b) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3">{b.cliente ?? "-"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={b.status === "ABERTO" ? "success" : "neutral"}>{b.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{b.aberto_em ?? "-"}</td>
                        <td className="px-4 py-3">
                          <Link to={`/blocos/${b.id}`} className="text-blue-600 hover:underline">
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}

                  {!loading && blocosRecentes.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={6}>
                        Nenhum bloco aberto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Lista mobile */}
            <div className="divide-y sm:hidden">
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={`skm-${i}`} className="p-4 space-y-2">
                    <SkeletonBox className="h-4 w-40" />
                    <SkeletonBox className="h-4 w-24" />
                    <SkeletonBox className="h-8 w-20 rounded-md" />
                  </div>
                ))}

              {!loading &&
                blocosRecentes.map((b) => (
                  <div key={b.id} className="p-4">
                    <div className="font-medium">{b.cliente ?? "-"}</div>
                    <div className="mt-1 text-sm text-slate-600">{b.aberto_em ?? "-"}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge tone={b.status === "ABERTO" ? "success" : "neutral"}>{b.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/blocos/${b.id}`)}>
                        Abrir
                      </Button>
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
