import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import ClienteForm from "./ClienteForm";
import { Card, CardContent } from "../components/ui/card"
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import { Plus, Search } from "lucide-react";

interface Cliente {
  id: number;
  nome_fantasia: string;
  cnpj_cpf: string;
  whatsapp: string;
  tipo_tabela: string;
  codigo_alfabetico?: string;
}

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `http://localhost:3333/clientes?search=${search}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setClientes(response.data.data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          setError(error.response?.data?.message || "Erro ao buscar clientes");
        } else if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Erro desconhecido");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, [search]);

  if (loading) return <div className="text-center py-10">Carregando...</div>;
  if (error) return <div className="text-center text-red-600">{error}</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Clientes</h2>
        <Button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <div className="relative w-full">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar cliente..."
            className="pl-10"
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {showForm && (
        <Card className="mb-6 shadow-lg">
          <CardContent>
            <ClienteForm />
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardContent className="p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-600">
              <tr>
                {["Nome Fantasia", "CNPJ/CPF", "WhatsApp", "Tipo de Tabela", "Ações"].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {clientes.length > 0 ? (
                clientes.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {cliente.nome_fantasia}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cliente.cnpj_cpf}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cliente.whatsapp}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cliente.tipo_tabela}
                    </td>
                    <td className="px-6 py-4 text-sm flex gap-3">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Detalhes
                      </Link>
                      <Link
                        to={`/clientes/${cliente.id}/documentos`}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Documentos
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    Nenhum cliente encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Clientes;
