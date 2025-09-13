import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import DominioItemForm from './DominioItemForm';

interface DominioItem {
  id: number;
  dominio_id: number;
  valor: string;
  codigo: string;
  ordem: number;
  ativo: boolean;
}

const DominioItens: React.FC = () => {
  const [itens, setItens] = useState<DominioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchItens = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:3333/dominios/${id}/itens`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setItens(response.data);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response) {
          setError(err.response.data.message || 'Erro ao buscar itens do domínio');
        } else {
          setError('Ocorreu um erro. Tente novamente.');
        }
        console.error('Erro ao buscar itens do domínio:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchItens();
  }, [id]);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>{error as string}</div>;

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Itens do Domínio</h2>
      {error && <p className="text-red-500">{error}</p>}
      <button
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
        onClick={() => setShowForm(true)}
      >
        Novo Item
      </button>
      {showForm && <DominioItemForm dominioId={id || ''} />}
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Valor</th>
            <th className="px-4 py-2">Código</th>
            <th className="px-4 py-2">Ordem</th>
            <th className="px-4 py-2">Ativo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id}>
              <td className="border px-4 py-2">{item.id}</td>
              <td className="border px-4 py-2">{item.valor}</td>
              <td className="border px-4 py-2">{item.codigo}</td>
              <td className="border px-4 py-2">{item.ordem}</td>
              <td className="border px-4 py-2">{item.ativo ? 'Sim' : 'Não'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DominioItens;
