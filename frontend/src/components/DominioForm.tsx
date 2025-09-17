// src/components/DominioForm.tsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const DominioForm: React.FC = () => {
  const [chave, setChave] = useState("");
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!chave.trim() || !nome.trim()) {
      setError("Informe a chave e o nome do domínio.");
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
        `${API_URL}/dominios`,
        { chave: chave.trim(), nome: nome.trim(), ativo },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Domínio cadastrado com sucesso!");
      setChave("");
      setNome("");
      setAtivo(true);
      setError(null);
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
        // se a chave já existir, o backend pode retornar 409 ou 400
        setError(err.response?.data?.message || "Erro ao cadastrar domínio");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro ao cadastrar domínio:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-4 text-xl font-semibold">Novo Domínio</h2>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="chave"
            className="mb-2 block text-sm font-bold text-gray-700"
          >
            Chave
          </label>
          <input
            type="text"
            id="chave"
            name="chave"
            className="w-full rounded border px-3 py-2 text-gray-700 shadow focus:outline-none focus:shadow-outline"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="Ex.: forma_pagamento, entrega, tipo_tabela..."
          />
        </div>

        <div>
          <label
            htmlFor="nome"
            className="mb-2 block text-sm font-bold text-gray-700"
          >
            Nome
          </label>
          <input
            type="text"
            id="nome"
            name="nome"
            className="w-full rounded border px-3 py-2 text-gray-700 shadow focus:outline-none focus:shadow-outline"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Rótulo legível (ex.: Formas de Pagamento)"
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
          className="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 focus:outline-none focus:shadow-outline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
};

export default DominioForm;
