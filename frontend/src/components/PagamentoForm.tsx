import React, { useState } from 'react';
import axios from 'axios';

const PagamentoForm: React.FC = () => {
  const [clienteId, setClienteId] = useState('');
  const [dataLancamento, setDataLancamento] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3333/pagamentos', {
        cliente_id: parseInt(clienteId),
        data_lancamento: dataLancamento,
        data_vencimento: dataVencimento,
        valor: parseFloat(valor),
        forma_pagamento: formaPagamento,
        observacoes: observacoes,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Pagamento cadastrado com sucesso!');
      setClienteId('');
      setDataLancamento('');
      setDataVencimento('');
      setValor('');
      setFormaPagamento('');
      setObservacoes('');
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Erro ao cadastrar pagamento');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error('Erro no cadastro de pagamento:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Novo Pagamento</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="clienteId" className="block text-gray-700 text-sm font-bold mb-2">
            ID do Cliente
          </label>
          <input
            type="number"
            id="clienteId"
            name="clienteId"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="dataLancamento" className="block text-gray-700 text-sm font-bold mb-2">
            Data de Lançamento
          </label>
          <input
            type="date"
            id="dataLancamento"
            name="dataLancamento"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={dataLancamento}
            onChange={(e) => setDataLancamento(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="dataVencimento" className="block text-gray-700 text-sm font-bold mb-2">
            Data de Vencimento
          </label>
          <input
            type="date"
            id="dataVencimento"
            name="dataVencimento"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="valor" className="block text-gray-700 text-sm font-bold mb-2">
            Valor
          </label>
          <input
            type="number"
            id="valor"
            name="valor"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="formaPagamento" className="block text-gray-700 text-sm font-bold mb-2">
            Forma de Pagamento
          </label>
          <select
            id="formaPagamento"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
          >
            <option value="">Selecione a Forma de Pagamento</option>
            <option value="BOLETO A VISTA - 01 DIAS">BOLETO A VISTA - 01 DIAS</option>
            <option value="BOLETO A VISTA - 07 DIAS">BOLETO A VISTA - 07 DIAS</option>
            <option value="BOLETO A VISTA - 15 DIAS">BOLETO A VISTA - 15 DIAS</option>
            <option value="BOLETO PRAZO - 05/10/15/20 DIAS">BOLETO PRAZO - 05/10/15/20 DIAS</option>
            <option value="BOLETO - 05/10/15/20 DIAS">BOLETO - 05/10/15/20 DIAS</option>
            <option value="BOLETO 15 DIAS">BOLETO 15 DIAS</option>
            <option value="BOLETO 30 DIAS">BOLETO 30 DIAS</option>
            <option value="BOLETO 30/60">BOLETO 30/60</option>
            <option value="BOLETO 30/45/60">BOLETO 30/45/60</option>
            <option value="BOLETO 30/45/60/75">BOLETO 30/45/60/75</option>
            <option value="BOLETO 30/45/60/75/90">BOLETO 30/45/60/75/90</option>
            <option value="BOLETO 30/60/90">BOLETO 30/60/90</option>
            <option value="BOLETO 30/60/90/120">BOLETO 30/60/90/120</option>
            <option value="CHEQUE A VISTA">CHEQUE A VISTA</option>
            <option value="CHEQUE NA ENTREGA - ATÉ 15 DIAS">CHEQUE NA ENTREGA - ATÉ 15 DIAS</option>
            <option value="CHEQUE NA ENTREGA - ATÉ 30 DIAS">CHEQUE NA ENTREGA - ATÉ 30 DIAS</option>
            <option value="CHEQUE NA ENTREGA - ATÉ 60 DIAS">CHEQUE NA ENTREGA - ATÉ 60 DIAS</option>
            <option value="CHEQUE NA ENTREGA - ATÉ 90 DIAS">CHEQUE NA ENTREGA - ATÉ 90 DIAS</option>
            <option value="CHEQUE NA ENTREGA - ATÉ 120 DIAS">CHEQUE NA ENTREGA - ATÉ 120 DIAS</option>
            <option value="CHEQUE NA ENTREGA ( 30/60/90 DIAS )">CHEQUE NA ENTREGA ( 30/60/90 DIAS )</option>
            <option value="CHEQUE NA ENTREGA ( DIAS IRREGULARES )">CHEQUE NA ENTREGA ( DIAS IRREGULARES )</option>
            <option value="DEPOSITA DEPOIS QUE RECEBE A MERCADORIA">DEPOSITA DEPOIS QUE RECEBE A MERCADORIA</option>
            <option value="DINHEIRO OU DEPÓSITO">DINHEIRO OU DEPÓSITO</option>
            <option value="ENTREGA MERCADORIA E RECEBE CHEQUE TERCEIRO DEPOIS">ENTREGA MERCADORIA E RECEBE CHEQUE TERCEIRO DEPOIS</option>
          </select>
        </div>
        <div>
          <label htmlFor="observacoes" className="block text-gray-700 text-sm font-bold mb-2">
            Observações
          </label>
          <textarea
            id="observacoes"
            name="observacoes"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
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

export default PagamentoForm;
