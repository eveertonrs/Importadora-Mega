// src/components/ClienteDocumentoForm.tsx
import React, { useState } from "react";
import axios from "axios";

interface ClienteDocumentoFormProps {
  clienteId: string;
  /** opcional: para o pai recarregar a lista após salvar */
  onCreated?: () => void;
}

type DocTipo = "CNPJ" | "CPF";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const ClienteDocumentoForm: React.FC<ClienteDocumentoFormProps> = ({
  clienteId,
  onCreated,
}) => {
  const [docTipo, setDocTipo] = useState<DocTipo>("CNPJ");
  const [docNumero, setDocNumero] = useState("");
  const [principal, setPrincipal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const apenasDigitos = (s: string) => s.replace(/\D+/g, "");

  // validação simples só por quantidade de dígitos
  const validaDocumento = (tipo: DocTipo, numero: string) => {
    const digits = apenasDigitos(numero);
    if (tipo === "CNPJ") return digits.length === 14;
    return digits.length === 11; // CPF
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (!docNumero.trim()) {
      setError("Informe o número do documento.");
      return;
    }
    if (!validaDocumento(docTipo, docNumero)) {
      setError(
        docTipo === "CNPJ"
          ? "CNPJ inválido (use 14 dígitos)."
          : "CPF inválido (use 11 dígitos)."
      );
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      await axios.post(
        `${API_URL}/clientes/${clienteId}/documentos`,
        {
          doc_tipo: docTipo,
          doc_numero: apenasDigitos(docNumero),
          principal,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOkMsg("Documento cadastrado com sucesso!");
      setDocTipo("CNPJ");
      setDocNumero("");
      setPrincipal(false);
      onCreated?.();
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError(err.response?.data?.message || "Erro ao cadastrar documento.");
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro ao cadastrar documento do cliente:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">
        Novo Documento do Cliente
      </h2>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {okMsg && <p className="mb-3 text-sm text-green-600">{okMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="docTipo"
            className="mb-1 block text-xs font-semibold uppercase text-gray-600"
          >
            Tipo de Documento
          </label>
          <select
            id="docTipo"
            className="w-full rounded-md border px-3 py-2 text-gray-800 focus:outline-none focus:ring"
            value={docTipo}
            onChange={(e) => setDocTipo(e.target.value as DocTipo)}
          >
            <option value="CNPJ">CNPJ</option>
            <option value="CPF">CPF</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="docNumero"
            className="mb-1 block text-xs font-semibold uppercase text-gray-600"
          >
            Número do Documento
          </label>
          <input
            type="text"
            id="docNumero"
            className="w-full rounded-md border px-3 py-2 text-gray-800 focus:outline-none focus:ring"
            placeholder={docTipo === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
            value={docNumero}
            onChange={(e) => setDocNumero(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">
            Informe apenas números; as máscaras são opcionais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="principal"
            className="h-4 w-4 rounded border-gray-300"
            checked={principal}
            onChange={(e) => setPrincipal(e.target.checked)}
          />
          <label htmlFor="principal" className="text-sm text-gray-800">
            Definir como principal
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
};

export default ClienteDocumentoForm;
