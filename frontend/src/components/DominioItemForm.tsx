import React, { useState } from 'react';
import axios from 'axios';
import {  } from 'react-router-dom';

interface DominioItemFormProps {
  dominioId: string;
}

const DominioItemForm: React.FC<DominioItemFormProps> = ({ dominioId }) => {
  const [valor, setValor] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ordem, setOrdem] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3333/dominios/${dominioId}/itens`, {
        valor: valor,
        codigo: codigo,
        ordem: parseInt(ordem),
        ativo: ativo,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Item do domínio cadastrado com sucesso!');
      setValor('');
      setCodigo('');
      setOrdem('');
      setAtivo(true);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Erro ao cadastrar item do domínio');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error('Erro ao cadastrar item do domínio:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Novo Item do Domínio</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="valor" className="block text-gray-700 text-sm font-bold mb-2">
            Valor
          </label>
          <input
            type="text"
            id="valor"
            name="valor"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="codigo" className="block text-gray-700 text-sm font-bold mb-2">
            Código
          </label>
          <input
            type="text"
            id="codigo"
            name="codigo"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ordem" className="block text-gray-700 text-sm font-bold mb-2">
            Ordem
          </label>
          <input
            type="number"
            id="ordem"
            name="ordem"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ativo" className="block text-gray-700 text-sm font-bold mb-2">
            Ativo
          </label>
          <input
            type="checkbox"
            id="ativo"
            name="ativo"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Salvar
        </button>
      </form>
    </div>
  );
};

export default DominioItemForm;
