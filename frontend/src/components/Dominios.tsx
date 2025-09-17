// src/components/Dominios.tsx
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

interface Dominio {
  id: number;
  chave: string;
  nome: string;
  ativo: boolean;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const Dominios: React.FC = () => {
  const navigate = useNavigate();
  const [dominios, setDominios] = useState<Dominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDominios = useCallback(async () => {
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.get(`${API_URL}/dominios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDominios(response.data as Dominio[]);
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
        setError(err.response?.data?.message || "Erro ao buscar domínios");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro ao buscar domínios:", err);
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDominios();
  }, [fetchDominios]);

  const handleToggleAtivo = async (dominio: Dominio) => {
    try {
      setReloading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      await axios.put(
        `${API_URL}/dominios/${dominio.id}`,
        { ativo: !dominio.ativo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchDominios();
    } catch (err: any) {
      setReloading(false);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        navigate("/login");
        return;
      }
      alert("Não foi possível atualizar o domínio.");
      console.error(err);
    }
  };

  const handleDelete = async (dominio: Dominio) => {
    if (!confirm(`Excluir o domínio "${dominio.nome}"?`)) return;
    try {
      setReloading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      await axios.delete(`${API_URL}/dominios/${dominio.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchDominios();
    } catch (err: any) {
      setReloading(false);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        navigate("/login");
        return;
      }
      alert(
        err.response?.data?.message ||
          "Não foi possível excluir o domínio (há itens vinculados?)."
      );
      console.error(err);
    }
  };

  if (loading) return <div className="p-4">Carregando...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Domínios</h2>
        <div className="flex gap-2">
          {/* Se você tiver uma rota/página com formulário, pode trocar por <Link to="/dominios/novo">Novo</Link> */}
          <Link
            to="/dominios" // ajuste se tiver tela específica de criação
            onClick={(e) => {
              e.preventDefault();
              alert(
                "Use o formulário de Domínio (DominioForm) para cadastrar. Após salvar, clique em Atualizar."
              );
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded"
          >
            Novo Domínio
          </Link>
          <button
            onClick={() => {
              setReloading(true);
              fetchDominios();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
          >
            {reloading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Chave</th>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">Ativo</th>
              <th className="px-4 py-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {dominios.map((dominio) => (
              <tr key={dominio.id} className="border-t">
                <td className="px-4 py-2">{dominio.id}</td>
                <td className="px-4 py-2">{dominio.chave}</td>
                <td className="px-4 py-2">{dominio.nome}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      dominio.ativo
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {dominio.ativo ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="px-4 py-2 flex flex-wrap gap-2">
                  <Link
                    to={`/dominios/${dominio.id}/itens`}
                    className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
                  >
                    Ver Itens
                  </Link>
                  <button
                    onClick={() => handleToggleAtivo(dominio)}
                    className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-sm"
                  >
                    {dominio.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => handleDelete(dominio)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {dominios.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-600" colSpan={5}>
                  Nenhum domínio cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dominios;
