// src/components/Register.tsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type Permissao = "admin" | "financeiro" | "vendedor";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const Register: React.FC = () => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [permissao, setPermissao] = useState<Permissao>("vendedor");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (senha.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    try {
      setSaving(true);
      await axios.post(`${API_URL}/auth/register`, {
        nome,
        email,
        senha,
        permissao, // "admin" | "financeiro" | "vendedor"
      });

      alert("Usuário cadastrado com sucesso!");
      setNome("");
      setEmail("");
      setSenha("");
      setPermissao("vendedor");
      navigate("/login");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Erro ao cadastrar usuário");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro no cadastro de usuário:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Criar usuário
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
                Nome
              </label>
              <input
                id="nome"
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                           placeholder-gray-400 focus:outline-none focus:ring-indigo-500
                           focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                           placeholder-gray-400 focus:outline-none focus:ring-indigo-500
                           focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700">
                Senha (mín. 6)
              </label>
              <input
                id="senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                           placeholder-gray-400 focus:outline-none focus:ring-indigo-500
                           focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="permissao" className="block text-sm font-medium text-gray-700">
                Permissão
              </label>
              <select
                id="permissao"
                value={permissao}
                onChange={(e) => setPermissao(e.target.value as Permissao)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                           bg-white focus:outline-none focus:ring-indigo-500
                           focus:border-indigo-500 sm:text-sm"
              >
                <option value="vendedor">Vendedor</option>
                <option value="financeiro">Financeiro</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md
                         shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                         disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? "Salvando..." : "Cadastrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
