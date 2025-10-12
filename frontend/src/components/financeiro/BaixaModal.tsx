import { useState, useMemo } from "react";
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
  const [valor, setValor] = useState<number>(pendente);
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const valorMax = useMemo(() => Math.max(0, Number(pendente || 0)), [pendente]);
  if (!open) return null;

  async function handleSave() {
    const v = Math.min(Math.max(0, Number(valor || 0)), valorMax);
    if (!v) return;
    setSaving(true);
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
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
          <h3 className="text-lg font-semibold">Registrar baixa</h3>
          <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
            Pendente: {money(valorMax)}
          </span>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block text-sm">
            <span className="text-slate-700">Valor</span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border px-3 py-2"
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
                placeholder="0,00"
              />
              <button
                type="button"
                className="whitespace-nowrap rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setValor(valorMax)}
                title="Preencher com o total pendente"
              >
                Tudo
              </button>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-700">Data baixa</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-700">Forma</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="PIX, DINHEIRO…"
                value={forma}
                onChange={(e) => setForma(e.target.value)}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-slate-700">Observação</span>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="opcional"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4">
          <button onClick={onClose} className="rounded-xl border px-3 py-2 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
