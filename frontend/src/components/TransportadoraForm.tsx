import React, { useState } from 'react';
import axios from 'axios';

const TransportadoraForm: React.FC = () => {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [formaEnvio, setFormaEnvio] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [referencia, setReferencia] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3333/transportadoras', {
        razao_social: razaoSocial,
        cnpj: cnpj,
        forma_envio: formaEnvio,
        telefone: telefone,
        endereco: endereco,
        referencia: referencia,
        ativo: ativo,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Transportadora cadastrada com sucesso!');
      setRazaoSocial('');
      setCnpj('');
      setFormaEnvio('');
      setTelefone('');
      setEndereco('');
      setReferencia('');
      setAtivo(true);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Erro ao cadastrar transportadora');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error('Erro no cadastro de transportadora:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Nova Transportadora</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="razaoSocial" className="block text-gray-700 text-sm font-bold mb-2">
            Razão Social
          </label>
          <input
            type="text"
            id="razaoSocial"
            name="razaoSocial"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cnpj" className="block text-gray-700 text-sm font-bold mb-2">
            CNPJ
          </label>
          <input
            type="text"
            id="cnpj"
            name="cnpj"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="formaEnvio" className="block text-gray-700 text-sm font-bold mb-2">
            Forma de Envio
          </label>
          <input
            type="text"
            id="formaEnvio"
            name="formaEnvio"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={formaEnvio}
            onChange={(e) => setFormaEnvio(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="telefone" className="block text-gray-700 text-sm font-bold mb-2">
            Telefone
          </label>
          <input
            type="text"
            id="telefone"
            name="telefone"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="endereco" className="block text-gray-700 text-sm font-bold mb-2">
            Endereço
          </label>
          <input
            type="text"
            id="endereco"
            name="endereco"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="referencia" className="block text-gray-700 text-sm font-bold mb-2">
            Referência
          </label>
          <input
            type="text"
            id="referencia"
            name="referencia"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
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

export default TransportadoraForm;
