// src/components/HistoricoPagamentos.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

interface Pagamento {
  id: number;
  cliente_id: number;
  data_lancamento: string; // ISO ou 'YYYY-MM-DD'
  data_vencimento: string; // ISO ou 'YYYY-MM-DD'
  valor: number;
  forma_pagamento: string;
  observacoes: string | null;
}

const formatCurrencyBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value ?? 0
  );

const formatDateBR = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // mostra cru se não for parseável
  return d.toLocaleDateString("pt-BR");
};

const getYMD = (value?: string) => {
  if (!value) return { dia: "-", mes: "-", ano: "-" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { dia: "-", mes: "-", ano: "-" };
  return {
    dia: String(d.getDate()).padStart(2, "0"),
    mes: String(d.getMonth() + 1).padStart(2, "0"),
    ano: String(d.getFullYear()),
  };
};

const HistoricoPagamentos: React.FC = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPagamentos = async () => {
      try {
        setError(null);
        setLoading(true);

        const token = localStorage.getItem("token");
        const resp = await axios.get<Pagamento[]>(`${API_URL}/pagamentos`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setPagamentos(resp.data ?? []);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            navigate("/login");
            return;
          }
          setError(err.response?.data?.message || "Erro ao buscar pagamentos");
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Ocorreu um erro. Tente novamente.");
        }
        console.error("Erro ao buscar pagamentos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPagamentos();
  }, [navigate]);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Histórico de Pagamentos</h2>
        <p className="text-gray-600">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Histórico de Pagamentos</h2>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </p>
      )}

      <div className="overflow-auto">
        <table className="min-w-full border border-gray-200 rounded">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">ID</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">
                Cliente ID
              </th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">
                Data de Lançamento
              </th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">
                Data de Vencimento
              </th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">Dia PG</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">Mês PG</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">Ano PG</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">Valor</th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">
                Forma de Pagamento
              </th>
              <th className="px-4 py-2 text-sm font-semibold text-gray-700">Observações</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {pagamentos.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-6 text-center text-gray-500"
                  colSpan={10}
                >
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            ) : (
              pagamentos.map((p) => {
                // Dia/Mês/Ano calculados a partir de data_vencimento:
                const { dia, mes, ano } = getYMD(p.data_vencimento);
                return (
                  <tr key={p.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-sm text-gray-800">{p.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.cliente_id}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {formatDateBR(p.data_lancamento)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {formatDateBR(p.data_vencimento)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{dia}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{mes}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{ano}</td>
                    <td className="px-4 py-2 text-sm text-gray-800">
                      {formatCurrencyBRL(p.valor)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {p.forma_pagamento}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {p.observacoes ?? "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoricoPagamentos;
