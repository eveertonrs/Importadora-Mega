import React, { useState } from 'react';
import axios from 'axios';

const ClienteForm: React.FC = () => {
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [entrega, setEntrega] = useState('');
  const [tipoTabela, setTipoTabela] = useState('');
  const [razaoSocialNF, setRazaoSocialNF] = useState('');
  const [cnpjCpfNF, setCnpjCpfNF] = useState('');
  const [tipoNota, setTipoNota] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3333/clientes', {
        nome_fantasia: nomeFantasia,
        cnpj_cpf: cnpjCpf,
        whatsapp: whatsapp,
        forma_pagamento: formaPagamento,
        entrega: entrega,
        tipo_tabela: tipoTabela,
        razao_social_nf: razaoSocialNF,
        cnpj_cpf_nf: cnpjCpfNF,
        tipo_nota: tipoNota,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Cliente cadastrado com sucesso!');
      setNomeFantasia('');
      setCnpjCpf('');
      setWhatsapp('');
      setFormaPagamento('');
      setEntrega('');
      setTipoTabela('');
      setRazaoSocialNF('');
      setCnpjCpfNF('');
      setTipoNota('');
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Erro ao cadastrar cliente');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error('Erro no cadastro de cliente:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Novo Cliente</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nome_fantasia" className="block text-gray-700 text-sm font-bold mb-2">
            Nome Fantasia
          </label>
          <input
            type="text"
            id="nome_fantasia"
            name="nome_fantasia"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cnpjCpf" className="block text-gray-700 text-sm font-bold mb-2">
            CNPJ/CPF Cliente
          </label>
          <input
            type="text"
            id="cnpjCpf"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={cnpjCpf}
            onChange={(e) => setCnpjCpf(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="whatsapp" className="block text-gray-700 text-sm font-bold mb-2">
            WhatsApp
          </label>
          <input
            type="text"
            id="whatsapp"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
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
          <label htmlFor="entrega" className="block text-gray-700 text-sm font-bold mb-2">
            Entrega
          </label>
          <select
            id="entrega"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={entrega}
            onChange={(e) => setEntrega(e.target.value)}
          >
            <option value="">Selecione o Tipo de Entrega</option>
            <option value="ENTREGAMOS">Entregamos</option>
            <option value="RETIRADA">Retirada</option>
            <option value="TRANSPORTADORA">Transportadora</option>
          </select>
        </div>
        <div>
          <label htmlFor="tipoTabela" className="block text-gray-700 text-sm font-bold mb-2">
            Tipo de Tabela
          </label>
          <select
            id="tipoTabela"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={tipoTabela}
            onChange={(e) => setTipoTabela(e.target.value)}
          >
            <option value="">Selecione o Tipo de Tabela</option>
            <option value="ESPECIAL">Especial</option>
            <option value="ATACADAO">Atacadao</option>
          </select>
        </div>
        <div>
          <label htmlFor="razaoSocialNF" className="block text-gray-700 text-sm font-bold mb-2">
            Razão Social (Nota Fiscal)
          </label>
          <input
            type="text"
            id="razaoSocialNF"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={razaoSocialNF}
            onChange={(e) => setRazaoSocialNF(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cnpjCpfNF" className="block text-gray-700 text-sm font-bold mb-2">
            CNPJ/CPF (Nota Fiscal)
          </label>
          <input
            type="text"
            id="cnpjCpfNF"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={cnpjCpfNF}
            onChange={(e) => setCnpjCpfNF(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tipoNota" className="block text-gray-700 text-sm font-bold mb-2">
            Tipo de Nota
          </label>
          <select
            id="tipoNota"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={tipoNota}
            onChange={(e) => setTipoNota(e.target.value)}
          >
            <option value="">Selecione o Tipo de Nota</option>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
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

export default ClienteForm;
