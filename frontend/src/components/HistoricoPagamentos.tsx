import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Pagamento {
  id: number;
  cliente_id: number;
  data_lancamento: string;
  data_vencimento: string;
  valor: number;
  forma_pagamento: string;
  observacoes: string;
}

const HistoricoPagamentos: React.FC = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPagamentos = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:3333/pagamentos', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setPagamentos(response.data);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response) {
          setError(err.response.data.message || 'Erro ao buscar pagamentos');
        } else {
          setError('Ocorreu um erro. Tente novamente.');
        }
        console.error('Erro ao buscar pagamentos:', err);
      }
    };

    fetchPagamentos();
  }, []);

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Histórico de Pagamentos</h2>
      {error && <p className="text-red-500">{error}</p>}
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Cliente ID</th>
            <th className="px-4 py-2">Data de Lançamento</th>
            <th className="px-4 py-2">Data de Vencimento</th>
            <th className="px-4 py-2">Valor</th>
            <th className="px-4 py-2">Forma de Pagamento</th>
            <th className="px-4 py-2">Observações</th>
            <th className="px-4 py-2">Data do Pedido</th>
            <th className="px-4 py-2">Débito</th>
            <th className="px-4 py-2">Crédito</th>
            <th className="px-4 py-2">Dia PG</th>
            <th className="px-4 py-2">Mês PG</th>
            <th className="px-4 py-2">Ano PG</th>
            <th className="px-4 py-2">Código</th>
            <th className="px-4 py-2">Tipo</th>
            <th className="px-4 py-2">NF / OBS</th>
          </tr>
        </thead>
        <tbody>
          {pagamentos.map((pagamento) => (
            <tr key={pagamento.id}>
              <td className="border px-4 py-2">{pagamento.id}</td>
              <td className="border px-4 py-2">{pagamento.cliente_id}</td>
              <td className="border px-4 py-2">{pagamento.data_lancamento}</td>
              <td className="border px-4 py-2">{pagamento.data_vencimento}</td>
              <td className="border px-4 py-2">{pagamento.valor}</td>
              <td className="border px-4 py-2">{pagamento.forma_pagamento}</td>
              <td className="border px-4 py-2">{pagamento.observacoes}</td>
              <td className="border px-4 py-2"></td> {/* Data do Pedido */}
              <td className="border px-4 py-2"></td> {/* Débito */}
              <td className="border px-4 py-2"></td> {/* Crédito */}
              <td className="border px-4 py-2"></td> {/* Dia PG */}
              <td className="border px-4 py-2"></td> {/* Mês PG */}
              <td className="border px-4 py-2"></td> {/* Ano PG */}
              <td className="border px-4 py-2"></td> {/* Código */}
              <td className="border px-4 py-2"></td> {/* Tipo */}
              <td className="border px-4 py-2"></td> {/* NF / OBS */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoricoPagamentos;
