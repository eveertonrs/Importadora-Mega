// src/components/financeiro/NovoTituloModal.tsx
import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

type Cliente = { id: number; nome_fantasia: string };

export default function NovoTituloModal({ open, onClose, onDone }: Props) {
  const [clienteInput, setClienteInput] = useState("");
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [cliOpts, setCliOpts] = useState<Cliente[]>([]);
  const [cliOpen, setCliOpen] = useState(false);

  const [tipo, setTipo] = useState<"CHEQUE" | "BOLETO" | "PIX" | "DEPOSITO">("BOLETO");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [bomPara, setBomPara] = useState("");
  const [valor, setValor] = useState<number | "">("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setClienteInput("");
    setClienteId(null);
    setCliOpts([]);
    setCliOpen(false);
    setTipo("BOLETO");
    setNumeroDoc("");
    setBomPara("");
    setValor("");
    setObs("");
  }, [open]);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setCliOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const q = clienteInput.trim();
    if (q.length < 2 || clienteId) {
      setCliOpts([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/clientes", { params: { search: q, limit: 10 } });
        setCliOpts((data?.data ?? data ?? []).slice(0, 10));
        setCliOpen(true);
      } catch {/* ignore */}
    }, 250);
    return () => clearTimeout(t);
  }, [clienteInput, clienteId]);

  if (!open) return null;

  async function salvar() {
    if (!clienteId || !valor || !bomPara) return;
    setLoading(true);
    try {
      await api.post("/financeiro/titulos", {
        cliente_id: Number(clienteId),
        tipo,
        numero_doc: numeroDoc || null,
        bom_para: bomPara,
        valor_bruto: Number(valor),
        observacao: obs || null,
      });
      onDone();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const tipos: typeof tipo[] = ["CHEQUE", "BOLETO", "PIX", "DEPOSITO"];

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Novo título a receber</h3>

        <div className="mt-3 space-y-3">
          {/* Auto-complete */}
          <div ref={boxRef}>
            <label className="text-sm block">Cliente</label>
            <div className="relative">
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Digite para buscar…"
                value={clienteInput}
                onChange={(e) => {
                  setClienteInput(e.target.value);
                  setClienteId(null);
                }}
                onFocus={() => cliOpts.length && setCliOpen(true)}
              />
              {cliOpen && cliOpts.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-lg">
                  {cliOpts.map((c) => (
                    <button
                      key={c.id}
                      className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => {
                        setClienteInput(c.nome_fantasia);
                        setClienteId(c.id);
                        setCliOpen(false);
                      }}
                    >
                      <div className="font-medium">{c.nome_fantasia}</div>
                      <div className="text-xs text-slate-500">#{c.id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clienteId && (
              <div className="mt-1 text-xs text-slate-600">
                Selecionado: <b>#{clienteId}</b>
              </div>
            )}
          </div>

          {/* Tipo (chips) */}
          <div>
            <label className="text-sm block mb-1">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {tipos.map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={[
                    "rounded-full px-3 py-1 text-xs ring-1",
                    t === tipo ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Nº Doc
              <input className="mt-1 w-full rounded-lg border px-3 py-2" value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} />
            </label>
            <label className="text-sm">
              Bom para
              <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={bomPara} onChange={(e) => setBomPara(e.target.value)} />
            </label>
          </div>

          <label className="text-sm">
            Valor
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={valor}
              onChange={(e) => setValor(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </label>

          <label className="text-sm">
            Observação
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-3 py-1.5">Cancelar</button>
          <button
            onClick={salvar}
            disabled={loading || !clienteId || !valor || !bomPara}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
