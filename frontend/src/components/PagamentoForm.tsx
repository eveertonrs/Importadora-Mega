// src/components/PagamentoForm.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";

type Cliente = { id: number; nome_fantasia: string };
// aceita tanto o formato com "nome" quanto "descricao" e (opcional) "ativo"
type Forma = { id: number; nome?: string; descricao?: string; ativo?: boolean };

export default function PagamentoForm() {
  // ====== estado principal ======
  const [clienteInput, setClienteInput] = useState("");
  const [clienteId, setClienteId] = useState<number | "">("");
  const [valor, setValor] = useState<string>(""); // string para facilitar digitação
  const [forma, setForma] = useState<string>("PIX");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // ====== auto-complete de cliente ======
  const [cliOpen, setCliOpen] = useState(false);
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const cliBoxRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(clienteInput, 250);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!cliBoxRef.current?.contains(e.target as Node)) setCliOpen(false);
    }
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
        const { data } = await api.get("/clientes", {
          params: { search: debouncedSearch, limit: 10 },
        });
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

  // ====== formas (carrega do backend; cai no default se falhar) ======
  const [formas, setFormas] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/pagamentos/formas");
        const list = (data?.data ?? data ?? []) as Forma[];

        const valores = list
          .filter((f) => (f.ativo === undefined ? true : !!f.ativo))
          .map((f) => (f.nome ?? f.descricao ?? "").trim())
          .filter(Boolean);

        if (valores.length) {
          setFormas(valores);
          setForma((prev) => (valores.includes(prev) ? prev : valores[0]));
          return;
        }
      } catch {
        /* falhou -> fallback abaixo */
      }

      const fallback = ["PIX", "BOLETO", "DINHEIRO"];
      setFormas(fallback);
      setForma((prev) => (fallback.includes(prev) ? prev : fallback[0]));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== submit ======
  const valorNumber = useMemo(() => {
    const normalized = valor.replace(/\./g, "").replace(",", ".").trim();
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }, [valor]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

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
      clearCliente();
      setValor("");
      setObs("");
      setOk(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha ao lançar pagamento.");
    } finally {
      setSaving(false);
    }
  }

  function onValorBlur() {
    const n = valorNumber;
    if (!Number.isNaN(n) && n >= 0) {
      setValor(
        n.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Lançar pagamento</h1>
        <p className="text-sm text-slate-500">Selecione o cliente, informe o valor e a forma de pagamento.</p>
      </div>

      <form onSubmit={save} className="rounded-2xl border bg-white shadow-sm">
        {(error || ok) && (
          <div className="p-4 border-b">
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
            {ok && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border-emerald-200 border rounded p-3">
                Pagamento lançado com sucesso!
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-12">
          {/* Cliente */}
          <section className="lg:col-span-12 space-y-2" ref={cliBoxRef}>
            <label className="text-sm text-slate-700">Cliente</label>
            <div className="relative">
              <input
                className="mt-1 border rounded px-3 py-2 w-full pr-24 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                  onClick={clearCliente}
                  title="Limpar"
                >
                  Limpar
                </button>
              )}
              {cliOpen && cliOpts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg max-h-64 overflow-auto">
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
              <div className="text-xs text-slate-600">
                Selecionado: <b>#{clienteId}</b>
              </div>
            )}
          </section>

          {/* Valor / Forma */}
          <section className="lg:col-span-6 space-y-2">
            <label className="text-sm text-slate-700">Valor</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={onValorBlur}
              required
            />
            <p className="text-xs text-slate-500">Use vírgula ou ponto para decimais.</p>
          </section>

          <section className="lg:col-span-6 space-y-2">
            <label className="text-sm text-slate-700">Forma</label>
            <select className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200" value={forma} onChange={(e) => setForma(e.target.value)}>
              {formas.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </section>

          {/* Observação */}
          <section className="lg:col-span-12 space-y-2">
            <label className="text-sm text-slate-700">Observação</label>
            <input className="mt-1 border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" />
          </section>
        </div>

        <div className="flex items-center gap-2 border-t p-4">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearCliente();
              setValor("");
              setObs("");
              setError(null);
              setOk(false);
            }}
            className="px-4 py-2 bg-slate-100 rounded-md hover:bg-slate-200"
          >
            Limpar
          </button>
        </div>
      </form>
    </div>
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
