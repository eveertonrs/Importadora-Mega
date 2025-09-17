// src/components/ClienteDetalhes.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import ClienteDocumentoForm from "./ClienteDocumentoForm";

type StatusCliente = "ATIVO" | "INATIVO";

interface Cliente {
  id: number;
  nome_fantasia: string;
  grupo_empresa?: string | null;
  tabela_preco?: string | null;
  status: StatusCliente;
  whatsapp?: string | null;
  anotacoes?: string | null;
  links_json?: string | null;
  /** calculado no backend e retornado junto, não é coluna física */
  codigo_alfabetico?: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const ClienteDetalhes: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCliente = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const { data } = await axios.get<Cliente>(`${API_URL}/clientes/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCliente(data);
      } catch (err: any) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            navigate("/login");
            return;
          }
          setError(err.response?.data?.message ?? "Erro ao buscar cliente.");
        } else {
          setError("Ocorreu um erro. Tente novamente.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchCliente();
  }, [id, navigate]);

  if (loading) {
    return <div className="p-6 text-gray-600">Carregando...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }
  if (!cliente) {
    return <div className="p-6 text-gray-600">Cliente não encontrado.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Detalhes do Cliente</h2>
        <button
          onClick={() => navigate(-1)}
          className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Voltar
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Informações</h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-gray-500">Nome Fantasia</dt>
              <dd className="text-sm text-gray-900">{cliente.nome_fantasia}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Grupo Empresa</dt>
              <dd className="text-sm text-gray-900">
                {cliente.grupo_empresa ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Tabela de Preço</dt>
              <dd className="text-sm text-gray-900">
                {cliente.tabela_preco ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Status</dt>
              <dd
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  cliente.status === "ATIVO"
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {cliente.status}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">WhatsApp</dt>
              <dd className="text-sm text-gray-900">
                {cliente.whatsapp ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Código Alfabético</dt>
              <dd className="text-sm text-gray-900">
                {cliente.codigo_alfabetico ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-500">Anotações</dt>
              <dd className="whitespace-pre-wrap text-sm text-gray-900">
                {cliente.anotacoes ?? "—"}
              </dd>
            </div>
            {cliente.links_json && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-gray-500">Links</dt>
                <dd className="text-sm text-gray-900 break-words">
                  {cliente.links_json}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Emissores de Nota (CPF/CNPJ)
          </h3>
          {/* O cliente quer gerenciar vários emissores com “principal” e tipo de nota.
              Seu form já faz o CRUD — mantive aqui para centralizar a gestão. */}
          <ClienteDocumentoForm clienteId={id ?? ""} />
        </div>
      </div>
    </div>
  );
};

export default ClienteDetalhes;
