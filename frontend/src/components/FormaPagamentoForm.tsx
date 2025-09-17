// src/components/FormaPagamentoForm.tsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const FormaPagamentoForm: React.FC = () => {
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!nome.trim()) {
      setError("Informe o nome da forma de pagamento.");
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_URL}/formas-pagamento`,
        { nome: nome.trim(), ativo },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess("Forma de pagamento cadastrada com sucesso!");
      setNome("");
      setAtivo(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          // token inválido/expirado
          navigate("/login");
          return;
        }
        setError(err.response?.data?.message || "Erro ao cadastrar forma de pagamento.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro no cadastro de forma de pagamento:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Nova Forma de Pagamento</h2>

      {error && (
        <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="nome"
            className="block text-gray-700 text-sm font-medium mb-1"
          >
            Nome *
          </label>
          <input
            type="text"
            id="nome"
            name="nome"
            autoComplete="off"
            required
            className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
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
          <label htmlFor="ativo" className="text-gray-700 text-sm">
            Ativo
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
};

export default FormaPagamentoForm;
