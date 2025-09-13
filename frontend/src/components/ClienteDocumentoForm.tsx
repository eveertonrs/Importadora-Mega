import React, { useState } from 'react';
import axios from 'axios';

interface ClienteDocumentoFormProps {
  clienteId: string;
}

const ClienteDocumentoForm: React.FC<ClienteDocumentoFormProps> = ({ clienteId }) => {
  const [docTipo, setDocTipo] = useState<'CNPJ' | 'CPF'>('CNPJ');
  const [docNumero, setDocNumero] = useState('');
  const [principal, setPrincipal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3333/clientes/${clienteId}/documentos`, {
        doc_tipo: docTipo,
        doc_numero: docNumero,
        principal: principal,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Documento do cliente cadastrado com sucesso!');
      setDocTipo('CNPJ');
      setDocNumero('');
      setPrincipal(false);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Erro ao cadastrar documento do cliente');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error('Erro ao cadastrar documento do cliente:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Novo Documento do Cliente</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="docTipo" className="block text-gray-700 text-sm font-bold mb-2">
            Tipo de Documento
          </label>
          <select
            id="docTipo"
            name="docTipo"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={docTipo}
            onChange={(e) => setDocTipo(e.target.value as 'CNPJ' | 'CPF')}
          >
            <option value="CNPJ">CNPJ</option>
            <option value="CPF">CPF</option>
          </select>
        </div>
        <div>
          <label htmlFor="docNumero" className="block text-gray-700 text-sm font-bold mb-2">
            Número do Documento
          </label>
          <input
            type="text"
            id="docNumero"
            name="docNumero"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={docNumero}
            onChange={(e) => setDocNumero(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="principal" className="block text-gray-700 text-sm font-bold mb-2">
            Principal
          </label>
          <input
            type="checkbox"
            id="principal"
            name="principal"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            checked={principal}
            onChange={(e) => setPrincipal(e.target.checked)}
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

export default ClienteDocumentoForm;
