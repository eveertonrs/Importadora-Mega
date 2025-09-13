import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

interface Dominio {
  id: number;
  chave: string;
  nome: string;
  ativo: boolean;
}

const Dominios: React.FC = () => {
  const [dominios, setDominios] = useState<Dominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDominios = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:3333/dominios', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setDominios(response.data);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response) {
          setError(err.response.data.message || 'Erro ao buscar domínios');
        } else {
          setError('Ocorreu um erro. Tente novamente.');
        }
        console.error('Erro ao buscar domínios:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDominios();
  }, []);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>{error as string}</div>;

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Domínios</h2>
      {error && <p className="text-red-500">{error}</p>}
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Chave</th>
            <th className="px-4 py-2">Nome</th>
            <th className="px-4 py-2">Ativo</th>
            <th className="px-4 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {dominios.map((dominio) => (
            <tr key={dominio.id}>
              <td className="border px-4 py-2">{dominio.id}</td>
              <td className="border px-4 py-2">{dominio.chave}</td>
              <td className="border px-4 py-2">{dominio.nome}</td>
              <td className="border px-4 py-2">{dominio.ativo ? 'Sim' : 'Não'}</td>
              <td className="border px-4 py-2">
                <Link to={`/dominios/${dominio.id}/itens`}>Ver Itens</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dominios;
