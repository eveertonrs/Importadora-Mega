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
  descricao?: string | null; // novo
  ativo: boolean;
};

export default function DominioItens() {
  const { id } = useParams();
  const dominioId = Number(id);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.valor.toLowerCase().includes(q) ||
        (it.codigo ?? "").toLowerCase().includes(q) ||
        (it.descricao ?? "").toLowerCase().includes(q)
    );
  }, [items, query]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(`/dominios/${dominioId}/itens`);
      setItems(data?.data ?? data ?? []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Falha ao carregar itens.");
      setItems([]);
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
    try {
      await api.delete(`/dominios/${dominioId}/itens/${itemId}`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao remover item.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <h1 className="text-xl font-semibold">Itens do domínio #{dominioId}</h1>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-sm">Buscar</label>
            <input
              className="border rounded px-3 py-2"
              placeholder="Valor, código ou descrição…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* NÃO passo mais onCreated (para não quebrar o seu form existente) */}
      <DominioItemForm dominioId={String(dominioId)} />

      <div className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">#</th>
              <th className="p-2 border text-left">Valor</th>
              <th className="p-2 border text-left">Código</th>
              <th className="p-2 border text-left">Ordem</th>
              <th className="p-2 border text-left">Descrição</th>
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
                <td className="p-2 border">{it.descricao ?? "-"}</td>
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
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Nenhum item encontrado
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center">
                  Carregando…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
    </div>
  );
}
