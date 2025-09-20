// src/components/DominioItens.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import DominioItemForm from "./DominioItemForm";

type Item = {
  id: number;
  valor: string;
  codigo?: string | null;
  ordem: number;
  ativo: boolean;
};

export default function DominioItens() {
  const { id } = useParams();
  const dominioId = Number(id);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.valor.toLowerCase().includes(q) ||
        (it.codigo ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/dominios/${dominioId}/itens`);
      setItems(data?.data ?? data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isFinite(dominioId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominioId]);

  async function removeItem(itemId: number) {
    if (!confirm("Remover este item?")) return;
    await api.delete(`/dominios/${dominioId}/itens/${itemId}`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Itens do domínio #{dominioId}
        </h1>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-sm">Buscar</label>
            <input
              className="border rounded px-3 py-2"
              placeholder="Valor ou código…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Formulário de criação */}
      <DominioItemForm dominioId={String(dominioId)} onCreated={load} />

      {/* Tabela */}
      <div className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">#</th>
              <th className="p-2 border text-left">Valor</th>
              <th className="p-2 border text-left">Código</th>
              <th className="p-2 border text-left">Ordem</th>
              <th className="p-2 border text-left">Ativo</th>
              <th className="p-2 border text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it.id} className="hover:bg-gray-50">
                <td className="p-2 border">{it.id}</td>
                <td className="p-2 border">{it.valor}</td>
                <td className="p-2 border">{it.codigo ?? "-"}</td>
                <td className="p-2 border">{it.ordem}</td>
                <td className="p-2 border">{it.ativo ? "Sim" : "Não"}</td>
                <td className="p-2 border">
                  <button
                    onClick={() => removeItem(it.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  Nenhum item encontrado
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center">
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
