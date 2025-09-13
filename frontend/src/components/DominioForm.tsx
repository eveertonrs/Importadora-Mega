import React, { useState } from 'react';
import axios from 'axios';

const DominioForm: React.FC = () => {
  const [chave, setChave] = useState('');
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3333/dominios', {
        chave: chave,
        nome: nome,
        ativo: ativo,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Domínio cadastrado com sucesso!');
      setChave('');
      setNome('');
      setAtivo(true);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Erro ao cadastrar domínio');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error('Erro ao cadastrar domínio:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Novo Domínio</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="chave" className="block text-gray-700 text-sm font-bold mb-2">
            Chave
          </label>
          <input
            type="text"
            id="chave"
            name="chave"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="nome" className="block text-gray-700 text-sm font-bold mb-2">
            Nome
          </label>
          <input
            type="text"
            id="nome"
            name="nome"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
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

export default DominioForm;
