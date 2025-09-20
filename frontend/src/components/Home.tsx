// src/components/Home.tsx
import { Link, useNavigate } from "react-router-dom";
import Button from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Badge from "./ui/badge";

const currency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Home() {
  const navigate = useNavigate();

  // dados que você já busca no componente (exemplo/mock aqui)
  const resumo = {
    clientes: 2,
    blocosAbertos: 2,
    saldoTop5: 3900,
  };

  const blocosRecentes = [
    { id: 6, codigo: "B1-MFPWQWNJ", cliente: "teste", status: "ABERTO", abertoEm: "18/09/2025, 18:13:22" },
    { id: 3, codigo: "B1-MFOQJ034", cliente: "teste", status: "ABERTO", abertoEm: "17/09/2025, 22:31:29" },
  ];

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
            <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30" onClick={() => navigate("/blocos")}>
              Abrir blocos
            </Button>
            <Button onClick={() => navigate("/pagamentos")}>Novo pagamento</Button>
          </div>
        </div>
      </section>

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
            <Button variant="ghost" onClick={() => navigate("/blocos")}>Blocos</Button>
            <Button variant="ghost" onClick={() => navigate("/clientes")}>Clientes</Button>
            <Button variant="ghost" onClick={() => navigate("/pagamentos")}>Pagamentos</Button>
            <Button variant="ghost" onClick={() => navigate("/historico-pagamentos")}>Histórico</Button>
            <Button variant="ghost" onClick={() => navigate("/formas-pagamento")}>Formas de Pagamento</Button>
            <Button variant="ghost" onClick={() => navigate("/transportadoras")}>Transportadoras</Button>
            <Button variant="ghost" onClick={() => navigate("/dominios")}>Domínios</Button>
          </CardContent>
        </Card>
      </section>

      {/* blocos recentes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-800">Blocos abertos (recentes)</h3>
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
                      <td className="px-4 py-3">{b.cliente}</td>
                      <td className="px-4 py-3">
                        <Badge tone="info">{b.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.abertoEm}</td>
                      <td className="px-4 py-3">
                        <Link to={`/blocos/${b.id}`} className="text-blue-600 hover:underline">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
