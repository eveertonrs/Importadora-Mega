// src/components/financeiro/BaixaModal.tsx
import { useState } from "react";
import { registrarBaixa } from "../../services/financeiro";

type Props = {
  open: boolean;
  onClose: () => void;
  tituloId: number;
  pendente: number;
  onDone: () => void;
};

const money = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function BaixaModal({ open, onClose, tituloId, pendente, onDone }: Props) {
  const [valor, setValor] = useState(pendente);
  const [data, setData] = useState<string>("");
  const [forma, setForma] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSave() {
    const v = Math.min(Math.max(0, Number(valor || 0)), pendente);
    if (!v) return;
    setLoading(true);
    try {
      await registrarBaixa(tituloId, {
        valor_baixa: v,
        data_baixa: data || undefined,
        forma_pagto: forma || undefined,
        obs: obs || undefined,
      });
      onDone();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Registrar baixa</h3>
          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
            Pendente: {money(pendente)}
          </span>
        </div>

        <label className="block text-sm">
          Valor
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
          />
          <div className="mt-2 flex gap-2">
            {[0.25, 0.5, 1].map((k) => (
              <button
                key={k}
                type="button"
                className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                onClick={() => setValor(Number((pendente * k).toFixed(2)))}
              >
                {k * 100}%
              </button>
            ))}
            <button
              type="button"
              className="ml-auto rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
              onClick={() => setValor(pendente)}
            >
              Tudo
            </button>
          </div>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Data baixa
            <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="block text-sm">
            Forma
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={forma} onChange={(e) => setForma(e.target.value)} placeholder="PIX, DINHEIRO..." />
          </label>
        </div>

        <label className="mt-3 block text-sm">
          Observação
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-3 py-1.5">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700">
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
