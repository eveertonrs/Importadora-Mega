import React, { useState } from 'react';
import axios from 'axios';

const FormaPagamentoForm: React.FC = () => {
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3333/formas-pagamento', {
        nome: nome,
        ativo: ativo,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Forma de pagamento cadastrada com sucesso!');
      setNome('');
      setAtivo(true);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Erro ao cadastrar forma de pagamento');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error('Erro no cadastro de forma de pagamento:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Nova Forma de Pagamento</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
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

export default FormaPagamentoForm;
