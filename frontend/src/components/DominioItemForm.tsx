import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface DominioItemFormProps {
  dominioId: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
    {children}
  </span>
);

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

      setValor("");
      setCodigo("");
      setOrdem("0");
      setAtivo(true);
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
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
    <div className="bg-white shadow rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Novo item do domínio</h2>
        {ativo && <Badge>Ativo</Badge>}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="valor" className="block text-sm font-medium text-slate-700">
            Valor *
          </label>
        <input
            id="valor"
            type="text"
            placeholder="Ex.: BOLETO 30/60/90"
            className="mt-1 w-full rounded border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="codigo" className="block text-sm font-medium text-slate-700">
            Código (opcional)
          </label>
          <input
            id="codigo"
            type="text"
            placeholder="Ex.: COD-BOLETO-306090"
            className="mt-1 w-full rounded border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="ordem" className="block text-sm font-medium text-slate-700">
            Ordem
          </label>
          <input
            id="ordem"
            type="number"
            min={0}
            className="mt-1 w-full rounded border px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="ativo"
            type="checkbox"
            className="h-4 w-4"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          <label htmlFor="ativo" className="text-sm font-medium text-slate-700">
            Ativo
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setValor("");
              setCodigo("");
              setOrdem("0");
              setAtivo(true);
              setError(null);
            }}
            className="rounded border px-4 py-2 hover:bg-slate-50"
          >
            Limpar
          </button>
        </div>
      </form>
    </div>
  );
};

export default DominioItemForm;
