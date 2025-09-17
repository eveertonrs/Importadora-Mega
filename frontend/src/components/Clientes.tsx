// src/components/Clientes.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import ClienteForm from "./ClienteForm";

// ajuste os paths se sua pasta "ui" estiver em outro lugar
import { Card, CardContent } from "./ui/card";
import Button from "./ui/button";
import Input from "./ui/input";
import { Plus, Search } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

interface Cliente {
  id: number;
  nome_fantasia: string;
  grupo_empresa?: string | null;
  tabela_preco: string | null;
  status: "ATIVO" | "INATIVO";
  whatsapp?: string | null;
  codigo_alfabetico?: string | null;
}

const isTokenExpired = (token: string): boolean => {
  try {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    const expiry = payload.exp as number;
    const now = Math.floor(Date.now() / 1000);
    return expiry < now;
  } catch {
    return true;
  }
};

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const fetchClientes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      if (!token || isTokenExpired(token)) {
        navigate("/login");
        return;
      }

      const response = await axios.get(`${API_URL}/clientes`, {
        params: { search },
        headers: { Authorization: `Bearer ${token}` },
      });

      // seu controller retorna { data, total, page, limit }
      setClientes(response.data.data ?? []);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
        setError(err.response?.data?.message || "Erro ao buscar clientes");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro desconhecido");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (loading) return <div className="py-10 text-center">Carregando...</div>;
  if (error) return <div className="text-center text-red-600">{error}</div>;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800">Clientes</h2>
        <Button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded bg-green-600 px-3 py-2 text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <div className="relative w-full">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar cliente..."
            className="w-full pl-10"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
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
                {[
                  "Nome Fantasia",
                  "WhatsApp",
                  "Tabela de Preço",
                  "Status",
                  "Ações",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {clientes.length > 0 ? (
                clientes.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {cliente.nome_fantasia}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cliente.whatsapp || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cliente.tabela_preco || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cliente.status}
                    </td>
                    <td className="flex gap-3 px-6 py-4 text-sm">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        Detalhes
                      </Link>
                      <Link
                        to={`/clientes/${cliente.id}/documentos`}
                        className="font-medium text-green-600 hover:text-green-800"
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
