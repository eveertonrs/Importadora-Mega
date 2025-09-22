// src/components/Home.tsx
import { Link, useNavigate } from "react-router-dom";
import Button from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Badge from "./ui/badge";
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

type BlocoItem = {
  id: number;
  codigo: string;
  cliente?: string;
  status: "ABERTO" | "FECHADO";
  aberto_em?: string;
};

const currency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// tenta extrair total do body (total|count) ou do header x-total-count
function extractTotal(resp: any): number {
  const h = resp?.headers;
  const fromHeader = h?.["x-total-count"] ?? h?.["X-Total-Count"];
  if (fromHeader) return Number(fromHeader) || 0;
  const d = resp?.data;
  if (d && typeof d.total === "number") return d.total;
  if (d && typeof d.count === "number") return d.count;
  // alguns endpoints já retornam um array puro; aí não tem como saber o total
  return Array.isArray(d) ? d.length : 0;
}

export default function Home() {
  const navigate = useNavigate();

  const [clientesTotal, setClientesTotal] = useState<number>(0);
  const [blocosAbertosTotal, setBlocosAbertosTotal] = useState<number>(0);
  const [saldoTop5, setSaldoTop5] = useState<number>(0);
  const [blocosRecentes, setBlocosRecentes] = useState<BlocoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // 1) total de clientes (usa paginação para obter o total)
        // se sua API não paginar, ainda assim cai no length
        const respClientes = await api.get("/clientes", {
          params: { page: 1, limit: 1 },
        });
        setClientesTotal(extractTotal(respClientes));

        // 2) blocos abertos recentes (limit 5) e total de abertos
        const respBlocos = await api.get("/blocos", {
          params: {
            status: "ABERTO",
            page: 1,
            limit: 5,
            sortBy: "aberto_em",
            sortDir: "DESC",
          },
        });

        // normaliza a lista vinda do backend (caso traga join do cliente)
        const lista: BlocoItem[] = (respBlocos.data?.data ?? respBlocos.data ?? []).map(
          (b: any) => ({
            id: b.id,
            codigo: b.codigo,
            cliente: b.cliente_nome ?? b.cliente?.nome_fantasia ?? b.cliente ?? "",
            status: b.status,
            aberto_em:
              b.aberto_em &&
              new Date(b.aberto_em).toLocaleString("pt-BR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
          })
        );

        setBlocosRecentes(lista);
        setBlocosAbertosTotal(extractTotal(respBlocos));

        // 3) saldoTop5 = soma do saldo dos 5 blocos listados
        // (chama /blocos/:id/saldo para cada um; se sua API já mandar saldo junto,
        // troque para usar diretamente b.saldo e remova essas chamadas)
        const saldosResp = await Promise.all(
          lista.map((b) => api.get(`/blocos/${b.id}/saldo`))
        );
        const soma = saldosResp.reduce((acc, r) => {
          // aceita { saldo: number } ou { data: { saldo } }
          const s = typeof r.data?.saldo === "number" ? r.data.saldo : r.data;
          const val = typeof s === "number" ? s : Number(s?.saldo ?? 0);
          return acc + (isFinite(val) ? val : 0);
        }, 0);

        setSaldoTop5(soma);
      } catch (e: any) {
        console.error("Erro no dashboard:", e);
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Falha ao carregar o dashboard.";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resumo = useMemo(
    () => ({
      clientes: clientesTotal,
      blocosAbertos: blocosAbertosTotal,
      saldoTop5,
    }),
    [clientesTotal, blocosAbertosTotal, saldoTop5]
  );

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white p-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold">Bem-vindo, Administrador</h2>
            <p className="mt-1 text-slate-300">
              Visão geral do financeiro e acessos rápidos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="bg-white/10 text-white hover:bg-white/20 border-white/30"
              onClick={() => navigate("/blocos")}
            >
              Abrir blocos
            </Button>
            <Button onClick={() => navigate("/pagamentos")}>Novo pagamento</Button>
          </div>
        </div>
      </section>

      {/* erros/loader */}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">
          Carregando resumo…
        </div>
      )}

      {/* métricas */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-500">Clientes</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <p className="text-4xl font-bold">{resumo.clientes}</p>
            <Link to="/clientes" className="text-blue-600 hover:underline">
              Ver clientes
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-slate-500">Blocos abertos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <p className="text-4xl font-bold">{resumo.blocosAbertos}</p>
            <Link to="/blocos" className="text-blue-600 hover:underline">
              Ver blocos
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-slate-500">Saldo (top 5 blocos)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-emerald-600">
              {currency(resumo.saldoTop5)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              ENTRADA – SAÍDA, status ≠ CANCELADO
            </p>
          </CardContent>
        </Card>
      </section>

      {/* atalhos */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-600">Acessos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => navigate("/blocos")}>
              Blocos
            </Button>
            <Button variant="ghost" onClick={() => navigate("/clientes")}>
              Clientes
            </Button>
            <Button variant="ghost" onClick={() => navigate("/pagamentos")}>
              Pagamentos
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/historico-pagamentos")}
            >
              Histórico
            </Button>
            <Button variant="ghost" onClick={() => navigate("/formas-pagamento")}>
              Formas de Pagamento
            </Button>
            <Button variant="ghost" onClick={() => navigate("/transportadoras")}>
              Transportadoras
            </Button>
            <Button variant="ghost" onClick={() => navigate("/dominios")}>
              Domínios
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* blocos recentes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-800">
            Blocos abertos (recentes)
          </h3>
          <Link to="/blocos" className="text-sm text-blue-600 hover:underline">
            ver todos
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="px-4 py-3 w-16">#</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Aberto em</th>
                    <th className="px-4 py-3 w-28">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {blocosRecentes.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{b.id}</td>
                      <td className="px-4 py-3 font-medium">{b.codigo}</td>
                      <td className="px-4 py-3">{b.cliente ?? "-"}</td>
                      <td className="px-4 py-3">
                        <Badge tone="info">{b.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.aberto_em ?? "-"}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/blocos/${b.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {blocosRecentes.length === 0 && !loading && (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={6}>
                        Nenhum bloco aberto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
