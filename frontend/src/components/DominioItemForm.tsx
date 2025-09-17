// src/components/DominioItemForm.tsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface DominioItemFormProps {
  dominioId: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const DominioItemForm: React.FC<DominioItemFormProps> = ({ dominioId }) => {
  const [valor, setValor] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ordem, setOrdem] = useState<string>("0");
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const toIntOrZero = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!valor.trim()) {
      setError("Informe o valor do item.");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      await axios.post(
        `${API_URL}/dominios/${dominioId}/itens`,
        {
          valor: valor.trim(),
          codigo: codigo.trim() || undefined,
          ordem: toIntOrZero(ordem),
          ativo,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Item do domínio cadastrado com sucesso!");
      setValor("");
      setCodigo("");
      setOrdem("0");
      setAtivo(true);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
        // domínio possui índice único (dominio_id, valor)
        setError(
          err.response?.data?.message ||
            "Erro ao cadastrar item do domínio. Verifique se já não existe um item com esse valor."
        );
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro ao cadastrar item do domínio:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Novo Item do Domínio</h2>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="valor"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Valor *
          </label>
          <input
            type="text"
            id="valor"
            name="valor"
            placeholder="Ex.: BOLETO 30/60/90"
            className="shadow appearance-none border rounded w-full px-3 py-2 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="codigo"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Código (opcional)
          </label>
          <input
            type="text"
            id="codigo"
            name="codigo"
            placeholder="Ex.: COD-BOLETO-306090"
            className="shadow appearance-none border rounded w-full px-3 py-2 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="ordem"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Ordem
          </label>
          <input
            type="number"
            id="ordem"
            name="ordem"
            min={0}
            className="shadow appearance-none border rounded w-full px-3 py-2 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ativo"
            name="ativo"
            className="h-4 w-4"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          <label htmlFor="ativo" className="text-sm font-bold text-gray-700">
            Ativo
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
};

export default DominioItemForm;
