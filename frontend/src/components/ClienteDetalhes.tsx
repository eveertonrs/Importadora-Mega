import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import ClienteDocumentoForm from './ClienteDocumentoForm';

interface Cliente {
  id: number;
  nome_fantasia: string;
  grupo_empresa: string;
  tabela_preco: string;
  status: string;
  whatsapp: string;
  anotacoes: string;
  links_json: string;
  codigo_alfabetico: string;
}

const ClienteDetalhes: React.FC = () => {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    const fetchCliente = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:3333/clientes/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCliente(response.data);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response) {
          setError(err.response.data.message || 'Erro ao buscar cliente');
        } else {
          setError('Ocorreu um erro. Tente novamente.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCliente();
  }, [id]);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>{error as string}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Detalhes do Cliente</h2>
      {cliente && (
        <div>
          <p>Nome Fantasia: {cliente.nome_fantasia}</p>
          <p>Grupo Empresa: {cliente.grupo_empresa}</p>
          <p>Tabela de Preço: {cliente.tabela_preco}</p>
          <p>Status: {cliente.status}</p>
          <p>WhatsApp: {cliente.whatsapp}</p>
          <p>Anotações: {cliente.anotacoes}</p>
          <p>Código Alfabético: {cliente.codigo_alfabetico}</p>
          <ClienteDocumentoForm clienteId={id || ''} />
        </div>
      )}
    </div>
  );
};

export default ClienteDetalhes;
