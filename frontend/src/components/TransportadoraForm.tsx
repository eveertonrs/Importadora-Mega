// src/components/TransportadoraForm.tsx
import React, { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const TransportadoraForm: React.FC = () => {
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [formaEnvio, setFormaEnvio] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [referencia, setReferencia] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setRazaoSocial("");
    setCnpj("");
    setFormaEnvio("");
    setTelefone("");
    setEndereco("");
    setReferencia("");
    setAtivo(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!razaoSocial.trim()) {
      setError("Razão Social é obrigatória.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Você precisa estar autenticado para cadastrar.");
      return;
    }

    try {
      setSaving(true);
      await axios.post(
        `${API_URL}/transportadoras`,
        {
          razao_social: razaoSocial.trim(),
          cnpj: cnpj.trim() || null,
          forma_envio: formaEnvio.trim() || null,
          telefone: telefone.trim() || null,
          endereco: endereco.trim() || null,
          referencia: referencia.trim() || null,
          ativo,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert("Transportadora cadastrada com sucesso!");
      resetForm();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError("Sessão expirada. Faça login novamente.");
        } else {
          setError(err.response?.data?.message || "Erro ao cadastrar transportadora");
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro no cadastro de transportadora:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Nova Transportadora</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="razaoSocial" className="block text-gray-700 text-sm font-bold mb-2">
            Razão Social *
          </label>
          <input
            type="text"
            id="razaoSocial"
            name="razaoSocial"
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700
                       leading-tight focus:outline-none focus:shadow-outline"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="cnpj" className="block text-gray-700 text-sm font-bold mb-2">
            CNPJ
          </label>
          <input
            type="text"
            id="cnpj"
            name="cnpj"
            placeholder="00.000.000/0000-00"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700
                       leading-tight focus:outline-none focus:shadow-outline"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="formaEnvio" className="block text-gray-700 text-sm font-bold mb-2">
            Forma de Envio
          </label>
          <input
            type="text"
            id="formaEnvio"
            name="formaEnvio"
            placeholder="Ex.: Rodoviário, Motoboy, Correios..."
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700
                       leading-tight focus:outline-none focus:shadow-outline"
            value={formaEnvio}
            onChange={(e) => setFormaEnvio(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="telefone" className="block text-gray-700 text-sm font-bold mb-2">
            Telefone
          </label>
          <input
            type="text"
            id="telefone"
            name="telefone"
            placeholder="(00) 00000-0000"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700
                       leading-tight focus:outline-none focus:shadow-outline"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="endereco" className="block text-gray-700 text-sm font-bold mb-2">
            Endereço
          </label>
          <input
            type="text"
            id="endereco"
            name="endereco"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700
                       leading-tight focus:outline-none focus:shadow-outline"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="referencia" className="block text-gray-700 text-sm font-bold mb-2">
            Referência
          </label>
          <input
            type="text"
            id="referencia"
            name="referencia"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700
                       leading-tight focus:outline-none focus:shadow-outline"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
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
          <label htmlFor="ativo" className="text-gray-700 text-sm font-bold">
            Ativo
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed
                     text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
};

export default TransportadoraForm;
