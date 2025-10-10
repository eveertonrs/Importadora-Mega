import { useEffect, useState } from "react";
import { conferenciaDiaria } from "../../services/financeiro";
import StatusBadge from "../ui/StatusBadge";
import { ensureClientNames, getClientName } from "../../utils/clientNameCache";

export default function Conferencia() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ resumo: Record<string, number>; titulos: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await conferenciaDiaria({ data: date });
      const titulos = r.titulos ?? [];

      const ids = Array.from(new Set(titulos.map((t: any) => Number(t.cliente_id)).filter(Boolean)));
      await ensureClientNames(ids);

      setData({
        resumo: r.resumo,
        titulos: titulos.map((t: any) => ({
          ...t,
          cliente_nome: getClientName(t.cliente_id, t.cliente_nome),
        })),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="text-sm">Data</label>
          <input
            type="date"
            className="mt-1 border rounded px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button onClick={load} className="h-10 px-3 rounded bg-blue-600 text-white">
          Aplicar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid sm:grid-cols-3 gap-3">
        {Object.entries(data?.resumo ?? {}).map(([tipo, valor]) => (
          <div key={tipo} className="p-3 rounded-xl border bg-white">
            <div className="text-xs text-slate-500">{tipo}</div>
            <div className="text-lg font-semibold">
              {Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Nº Doc</th>
              <th className="px-3 py-2 text-left">Bom para</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-right">Baixado</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-6 text-center" colSpan={7}>
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && (data?.titulos ?? []).length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center" colSpan={7}>
                  Sem lançamentos
                </td>
              </tr>
            )}
            {(data?.titulos ?? []).map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">{getClientName(t.cliente_id, t.cliente_nome)}</td>
                <td className="px-3 py-2">{t.tipo}</td>
                <td className="px-3 py-2">{t.numero_doc ?? "-"}</td>
                <td className="px-3 py-2">{t.bom_para ? new Date(t.bom_para).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2 text-right">
                  {Number(t.valor_bruto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-3 py-2 text-right">
                  {Number(t.valor_baixado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge value={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
