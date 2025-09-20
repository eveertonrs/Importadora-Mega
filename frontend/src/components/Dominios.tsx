// src/components/Dominios.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

type Dominio = {
  id: number;
  chave: string;
  nome: string;
  ativo: boolean;
};

export default function Dominios() {
  const [rows, setRows] = useState<Dominio[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyStatus, setOnlyStatus] = useState<"" | "ATIVOS" | "INATIVOS">("");

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/dominios");
      setRows(data?.data ?? data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (onlyStatus === "ATIVOS") list = list.filter((d) => d.ativo);
    if (onlyStatus === "INATIVOS") list = list.filter((d) => !d.ativo);
    if (!q) return list;
    return list.filter(
      (d) =>
        d.nome.toLowerCase().includes(q) ||
        d.chave.toLowerCase().includes(q) ||
        String(d.id).includes(q)
    );
  }, [rows, query, onlyStatus]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <h1 className="text-xl font-semibold">Domínios</h1>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-sm">Buscar</label>
            <input
              className="border rounded px-3 py-2"
              placeholder="nome, chave ou #id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm">Status</label>
            <select
              className="border rounded px-3 py-2"
              value={onlyStatus}
              onChange={(e) =>
                setOnlyStatus(e.target.value as "" | "ATIVOS" | "INATIVOS")
              }
            >
              <option value="">(todos)</option>
              <option value="ATIVOS">Ativos</option>
              <option value="INATIVOS">Inativos</option>
            </select>
          </div>
          <Link
            to="/dominios/novo"
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Novo
          </Link>
        </div>
      </div>

      <div className="rounded border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">#</th>
              <th className="p-2 border text-left">Chave</th>
              <th className="p-2 border text-left">Nome</th>
              <th className="p-2 border text-left">Status</th>
              <th className="p-2 border text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="p-2 border">{d.id}</td>
                <td className="p-2 border font-mono">{d.chave}</td>
                <td className="p-2 border">{d.nome}</td>
                <td className="p-2 border">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.ativo
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                    }`}
                  >
                    {d.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="p-2 border">
                  <div className="flex gap-3">
                    <Link
                      to={`/dominios/${d.id}/itens`}
                      className="text-blue-600 underline"
                    >
                      Itens
                    </Link>
                    <Link
                      to={`/dominios/${d.id}/editar`}
                      className="text-emerald-700 underline"
                    >
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  Nenhum domínio
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="p-4 text-center">
                  Carregando…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
