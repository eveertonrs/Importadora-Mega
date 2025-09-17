// src/components/ClienteForm.tsx
import React, { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const ClienteForm: React.FC = () => {
  // colunas reais da tabela `clientes`
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [grupoEmpresa, setGrupoEmpresa] = useState("");
  const [tabelaPreco, setTabelaPreco] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [anotacoes, setAnotacoes] = useState("");

  // opcional: criar documento principal (CPF/CNPJ) após criar o cliente
  const [docNumero, setDocNumero] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onlyDigits = (s: string) => s.replace(/\D+/g, "");
  const inferDocTipo = (val: string): "CPF" | "CNPJ" | null => {
    const d = onlyDigits(val);
    if (d.length === 11) return "CPF";
    if (d.length === 14) return "CNPJ";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (!nomeFantasia.trim()) {
      setError("Informe o Nome Fantasia.");
      return;
    }
    if (!tabelaPreco) {
      setError("Selecione a Tabela de Preço.");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      // 1) cria o cliente (apenas campos existentes no backend)
      const createResp = await axios.post(
        `${API_URL}/clientes`,
        {
          nome_fantasia: nomeFantasia,
          grupo_empresa: grupoEmpresa || null,
          tabela_preco: tabelaPreco,
          // status tem default 'ATIVO' no banco — pode omitir
          whatsapp: onlyDigits(whatsapp) || null,
          anotacoes: anotacoes || null,
          links_json: null, // se quiser, pode omitir também
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const created = createResp.data?.data ?? createResp.data;
      const clienteId = created.id;

      // 2) se informou CPF/CNPJ, cria o documento principal
      const digits = onlyDigits(docNumero);
      if (digits) {
        const tipo = inferDocTipo(digits);
        if (!tipo) {
          setError(
            "Documento inválido. Use 11 dígitos para CPF ou 14 para CNPJ."
          );
          return;
        }
        await axios.post(
          `${API_URL}/clientes/${clienteId}/documentos`,
          { doc_tipo: tipo, doc_numero: digits, principal: true },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setOkMsg("Cliente cadastrado com sucesso!");
      // limpa o formulário
      setNomeFantasia("");
      setGrupoEmpresa("");
      setTabelaPreco("");
      setWhatsapp("");
      setAnotacoes("");
      setDocNumero("");
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as any;
        if (Array.isArray(data?.errors) && data.errors.length) {
          // erros do Zod no backend
          setError(data.errors.map((e: any) => e.message).join(" | "));
        } else if (data?.message) {
          setError(data.message);
        } else if (err.response?.status === 401) {
          window.location.href = "/login";
          return;
        } else {
          setError("Erro ao cadastrar cliente.");
        }
      } else {
        setError("Ocorreu um erro. Tente novamente.");
      }
      console.error("Erro no cadastro de cliente:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow">
      <h2 className="mb-4 text-xl font-semibold">Novo Cliente</h2>

      {error && <p className="mb-3 text-sm text-red-600">Erro de validação: {error}</p>}
      {okMsg && <p className="mb-3 text-sm text-green-600">{okMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nome_fantasia" className="mb-1 block text-sm font-bold text-gray-700">
            Nome Fantasia
          </label>
          <input
            id="nome_fantasia"
            className="w-full rounded border px-3 py-2"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="grupo_empresa" className="mb-1 block text-sm font-bold text-gray-700">
            Grupo / Empresa
          </label>
          <input
            id="grupo_empresa"
            className="w-full rounded border px-3 py-2"
            value={grupoEmpresa}
            onChange={(e) => setGrupoEmpresa(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="tabela_preco" className="mb-1 block text-sm font-bold text-gray-700">
            Tabela de Preço
          </label>
          <select
            id="tabela_preco"
            className="w-full rounded border px-3 py-2"
            value={tabelaPreco}
            onChange={(e) => setTabelaPreco(e.target.value)}
          >
            <option value="">Selecione</option>
            <option value="ESPECIAL">Especial</option>
            <option value="ATACADAO">Atacadão</option>
            {/* se preferir, carregue essas opções de /dominios */}
          </select>
        </div>

        <div>
          <label htmlFor="whatsapp" className="mb-1 block text-sm font-bold text-gray-700">
            WhatsApp
          </label>
          <input
            id="whatsapp"
            className="w-full rounded border px-3 py-2"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(apenas números)"
            inputMode="numeric"
          />
        </div>

        <div>
          <label htmlFor="anotacoes" className="mb-1 block text-sm font-bold text-gray-700">
            Anotações
          </label>
          <textarea
            id="anotacoes"
            className="w-full rounded border px-3 py-2"
            rows={3}
            value={anotacoes}
            onChange={(e) => setAnotacoes(e.target.value)}
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            (Opcional) Criar documento principal agora
          </h3>
          <label htmlFor="doc" className="mb-1 block text-xs font-semibold uppercase text-gray-600">
            CPF/CNPJ
          </label>
          <input
            id="doc"
            className="w-full rounded border px-3 py-2"
            placeholder="Apenas números (11 p/ CPF, 14 p/ CNPJ)"
            value={docNumero}
            onChange={(e) => setDocNumero(e.target.value)}
            inputMode="numeric"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
};

export default ClienteForm;
