// src/components/DominioForm.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function DominioForm() {
  const nav = useNavigate();

  const [chave, setChave] = useState("");
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function slugify(input: string) {
    return input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body = {
      chave: (chave || slugify(nome)).trim(),
      nome: nome.trim(),
      ativo,
    };

    if (!body.chave || !body.nome) {
      setError("Informe a chave e o nome do domínio.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/dominios", body);
      // feedback simples e volta para a lista
      alert("Domínio cadastrado com sucesso!");
      nav("/dominios");
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        (err?.response?.status === 409
          ? "Já existe um domínio com essa chave."
          : "Erro ao cadastrar domínio.");
      setError(message);
      console.error("DominioForm error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl rounded-xl border bg-white p-4 md:p-6 shadow-sm">
      <h1 className="mb-2 text-lg md:text-xl font-semibold">Novo domínio</h1>
      <p className="mb-4 text-sm text-slate-500">
        Cadastre chaves de domínio para listas de valores (ex.: formas de pagamento, entregas).
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="nome" className="text-sm text-slate-700">
            Nome
          </label>
          <input
            id="nome"
            className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Formas de Pagamento"
          />
          <div className="mt-1 text-xs text-slate-500">
            Dica: se a chave ficar vazia, geramos automaticamente a partir do nome.
          </div>
        </div>

        <div>
          <label htmlFor="chave" className="text-sm text-slate-700">
            Chave
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="chave"
              className="flex-1 rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="Ex.: forma_pagamento, entrega, tipo_tabela…"
            />
            <button
              type="button"
              onClick={() => setChave(slugify(nome))}
              className="whitespace-nowrap rounded border px-3 py-2 text-sm hover:bg-slate-50"
            >
              Gerar
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 select-none">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          <span className="text-sm text-slate-700">Ativo</span>
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => nav("/dominios")}
            className="rounded border px-4 py-2 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
