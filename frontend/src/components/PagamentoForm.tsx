// src/components/PagamentoForm.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

type Cliente = { id: number; nome_fantasia: string };
type Forma = { id: number; descricao: string; ativo: boolean };

export default function PagamentoForm() {
  // ====== estado principal ======
  const [clienteInput, setClienteInput] = useState("");
  const [clienteId, setClienteId] = useState<number | "">("");
  const [valor, setValor] = useState<string>(""); // usa string para não quebrar digitação
  const [forma, setForma] = useState<string>("PIX");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ====== auto-complete de cliente ======
  const [cliOpen, setCliOpen] = useState(false);
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const cliBoxRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(clienteInput, 250);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!cliBoxRef.current?.contains(e.target as Node)) setCliOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debouncedSearch.trim().length < 2 || clienteId !== "") {
      setCliOpts([]);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.get("/clientes", { params: { search: debouncedSearch } });
        if (cancel) return;
        const list: Cliente[] = (data?.data ?? data ?? []).slice(0, 10);
        setCliOpts(list);
        setCliOpen(list.length > 0);
      } catch {
        // silencioso
      }
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedSearch, clienteId]);

  function selectCliente(c: Cliente) {
    setClienteInput(c.nome_fantasia);
    setClienteId(c.id);
    setCliOpen(false);
  }
  function clearCliente() {
    setClienteInput("");
    setClienteId("");
    setCliOpts([]);
    setCliOpen(false);
  }

  // ====== formas de pagamento (carrega do backend se existir) ======
  const [formas, setFormas] = useState<string[]>(["PIX", "BOLETO", "DINHEIRO"]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/pagamentos/formas");
        // aceita tanto [{descricao}] quanto array simples
        const list = (data?.data ?? data ?? []) as any[];
        const valores = list.map((f: any) => (typeof f === "string" ? f : f.descricao)).filter(Boolean);
        if (valores.length) {
          setFormas(valores);
          if (!valores.includes(forma)) setForma(valores[0]);
        }
      } catch {
        // segue com defaults
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== submit ======
  const valorNumber = useMemo(() => {
    const normalized = valor.replace(",", ".").trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }, [valor]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (clienteId === "") {
      setError("Selecione um cliente.");
      return;
    }
    if (!valor || Number.isNaN(valorNumber) || valorNumber <= 0) {
      setError("Informe um valor válido.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/pagamentos", {
        cliente_id: Number(clienteId),
        valor: valorNumber,
        forma_pagamento: forma,
        observacao: obs || null,
      });
      // reset
      clearCliente();
      setValor("");
      setObs("");
      alert("Pagamento lançado!");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha ao lançar pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">Lançar pagamento</h1>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Cliente (auto-complete) */}
        <div className="md:col-span-2" ref={cliBoxRef}>
          <label className="text-sm block mb-1">Cliente</label>
          <div className="relative">
            <input
              className="border rounded px-3 py-2 w-full pr-20"
              placeholder="Digite para buscar pelo nome…"
              value={clienteInput}
              onChange={(e) => {
                setClienteInput(e.target.value);
                if (clienteId !== "") setClienteId("");
              }}
              onFocus={() => {
                if (cliOpts.length > 0) setCliOpen(true);
              }}
              required
            />
            {(clienteId !== "" || clienteInput) && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                onClick={clearCliente}
                title="Limpar"
              >
                Limpar
              </button>
            )}
            {cliOpen && cliOpts.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">
                {cliOpts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                    onClick={() => selectCliente(c)}
                  >
                    <div className="font-medium">{c.nome_fantasia}</div>
                    <div className="text-xs text-slate-500">#{c.id}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {clienteId !== "" && (
            <div className="mt-1 text-xs text-slate-600">
              Selecionado: <b>#{clienteId}</b>
            </div>
          )}
        </div>

        {/* Valor */}
        <div>
          <label className="text-sm block mb-1">Valor</label>
          <input
            className="border rounded px-3 py-2 w-full"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          <div className="text-xs text-slate-500 mt-1">
            Use vírgula ou ponto para decimais.
          </div>
        </div>

        {/* Forma */}
        <div>
          <label className="text-sm block mb-1">Forma</label>
          <select
            className="border rounded px-3 py-2 w-full"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
          >
            {formas.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Observação */}
        <div className="md:col-span-2">
          <label className="text-sm block mb-1">Observação</label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="opcional"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}

/** Debounce simples para texto */
function useDebounce<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
