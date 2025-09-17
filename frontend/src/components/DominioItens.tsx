// src/components/DominioItens.tsx
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import DominioItemForm from "./DominioItemForm";

interface DominioItem {
  id: number;
  dominio_id: number;
  valor: string;
  codigo: string | null;
  ordem: number;
  ativo: boolean;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const DominioItens: React.FC = () => {
  const { id: dominioId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [itens, setItens] = useState<DominioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reloading, setReloading] = useState(false);

  const fetchItens = useCallback(async () => {
    if (!dominioId) return;
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const resp = await axios.get(`${API_URL}/dominios/${dominioId}/itens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItens(resp.data as DominioItem[]);
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
        setError(err.response?.data?.message || "Erro ao buscar itens do domínio");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro ao buscar itens do domínio:", err);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, [dominioId, navigate]);

  useEffect(() => {
    fetchItens();
  }, [fetchItens]);

  const handleToggleAtivo = async (item: DominioItem) => {
    try {
      setReloading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      await axios.put(
        `${API_URL}/dominios/${item.dominio_id}/itens/${item.id}`,
        { ativo: !item.ativo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchItens();
    } catch (err: any) {
      setReloading(false);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        navigate("/login");
        return;
      }
      alert("Não foi possível atualizar o item.");
      console.error(err);
    }
  };

  const handleDelete = async (item: DominioItem) => {
    if (!confirm(`Excluir o item "${item.valor}"?`)) return;

    try {
      setReloading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      await axios.delete(
        `${API_URL}/dominios/${item.dominio_id}/itens/${item.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchItens();
    } catch (err: any) {
      setReloading(false);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        navigate("/login");
        return;
      }
      alert("Não foi possível excluir o item.");
      console.error(err);
    }
  };

  if (!dominioId) {
    return <div className="p-4 text-red-600">ID do domínio inválido.</div>;
  }

  if (loading) return <div className="p-4">Carregando...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Itens do Domínio</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded"
          >
            {showForm ? "Fechar" : "Novo Item"}
          </button>
          <button
            onClick={() => {
              setReloading(true);
              fetchItens();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
          >
            {reloading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6">
          {/* Para recarregar lista após salvar, adicione onSaved no form (ver nota abaixo) */}
          <DominioItemForm
            dominioId={dominioId}
            // @ts-ignore — se você aplicar a versão do form com onSaved, remova este ignore
            onSaved={() => {
              setShowForm(false);
              setReloading(true);
              fetchItens();
            }}
          />
        </div>
      )}

      {itens.length === 0 ? (
        <div className="text-gray-600">Nenhum item cadastrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Valor</th>
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Ordem</th>
                <th className="px-4 py-2 text-left">Ativo</th>
                <th className="px-4 py-2 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2">{item.id}</td>
                  <td className="px-4 py-2">{item.valor}</td>
                  <td className="px-4 py-2">{item.codigo ?? "-"}</td>
                  <td className="px-4 py-2">{item.ordem}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.ativo
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {item.ativo ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleToggleAtivo(item)}
                      className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-sm"
                    >
                      {item.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DominioItens;
