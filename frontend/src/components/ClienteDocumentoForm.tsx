import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

const formatCpf = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};
const formatCnpj = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const validateCPF = (cpf: string) => {
  const s = onlyDigits(cpf);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let sum = 0, rest = 0;
  for (let i = 1; i <= 9; i++) sum += parseInt(s.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(s.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(s.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(s.substring(10, 11));
};

const validateCNPJ = (cnpj: string) => {
  const s = onlyDigits(cnpj);
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  const calc = (base: number[]) => {
    let sum = 0;
    const weights = base.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    base.forEach((v, i) => sum += v * weights[i]);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const nums = s.split("").map(n => parseInt(n));
  const d1 = calc(nums.slice(0, 12));
  const d2 = calc(nums.slice(0, 12).concat(d1));
  return d1 === nums[12] && d2 === nums[13];
};

type Doc = {
  id: number;
  cliente_id: number;
  doc_tipo: "CNPJ" | "CPF";
  doc_numero: string;
  principal: boolean;
  modelo_nota?: string | null;
  percentual_nf?: number | null;
};

export default function ClienteDocumentoForm() {
  const { id } = useParams();
  const nav = useNavigate();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);

  const [docTipo, setDocTipo] = useState<"CNPJ" | "CPF">("CNPJ");
  const [docNumeroRaw, setDocNumeroRaw] = useState("");
  const [docPrincipal, setDocPrincipal] = useState(true);
  const [percentual, setPercentual] = useState<number>(100);
  const [savingDoc, setSavingDoc] = useState(false);
  const [errDoc, setErrDoc] = useState<string | null>(null);

  const docNumeroMasked = useMemo(
    () => (docTipo === "CPF" ? formatCpf(docNumeroRaw) : formatCnpj(docNumeroRaw)),
    [docNumeroRaw, docTipo]
  );
  const docNumeroClean = useMemo(() => onlyDigits(docNumeroMasked), [docNumeroMasked]);

  const docInvalido = useMemo(() => {
    if (!docNumeroClean) return true;
    if (docTipo === "CPF") return !validateCPF(docNumeroClean);
    return !validateCNPJ(docNumeroClean);
  }, [docNumeroClean, docTipo]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/clientes/${id}/documentos`);
      setDocs(data?.documentos ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function addDoc() {
    setSavingDoc(true);
    setErrDoc(null);
    try {
      await api.post(`/clientes/${id}/documentos`, {
        doc_tipo: docTipo,
        doc_numero: docNumeroClean,
        principal: !!docPrincipal,
        percentual_nf: Math.max(0, Math.min(100, percentual)),
        modelo_nota: "",
      });
      setDocNumeroRaw("");
      setPercentual(100);
      await load();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 409
          ? "Documento já cadastrado para este cliente"
          : "Falha ao salvar documento.");
      setErrDoc(msg);
    } finally {
      setSavingDoc(false);
    }
  }

  async function delDoc(docId: number) {
    if (!confirm("Remover este documento?")) return;
    try {
      await api.delete(`/clientes/${id}/documentos/${docId}`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao remover documento.");
    }
  }

  async function updatePercentual(docId: number, p: number) {
    try {
      await api.put(`/clientes/${id}/documentos/${docId}`, {
        percentual_nf: Math.max(0, Math.min(100, p)),
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao atualizar percentual.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="px-3 py-2 rounded border hover:bg-slate-50">
          ← Voltar
        </button>
        <h1 className="text-xl font-semibold">Documentos do cliente #{id}</h1>
      </div>

      <div className="rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
        <h2 className="font-medium">Documentos fiscais</h2>

        {errDoc && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {errDoc}
          </div>
        )}

        <div className="grid md:grid-cols-5 gap-3">
          <div>
            <label className="text-sm">Tipo</label>
            <select
              className="mt-1 border rounded px-3 py-2 w-full"
              value={docTipo}
              onChange={(e) => setDocTipo((e.target.value as "CNPJ" | "CPF") ?? "CNPJ")}
            >
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm flex items-center justify-between">
              <span>Número</span>
              {docNumeroClean && (
                <span
                  className={[
                    "text-xs px-1.5 py-0.5 rounded",
                    docInvalido ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {docInvalido ? "Inválido" : "Válido"}
                </span>
              )}
            </label>
            <input
              className={[
                "mt-1 border rounded px-3 py-2 w-full",
                docNumeroClean && docInvalido ? "border-rose-400 ring-rose-200" : "",
              ].join(" ")}
              value={docNumeroMasked}
              onChange={(e) => setDocNumeroRaw(e.target.value)}
              placeholder={docTipo === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              inputMode="numeric"
            />
            <p className="text-xs text-slate-500 mt-1">
              Digite apenas números; a máscara é automática.
            </p>
          </div>

          <div>
            <label className="text-sm">Percentual da nota</label>
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 border rounded px-3 py-2 w-full"
              value={percentual}
              onChange={(e) => setPercentual(Number(e.target.value))}
              placeholder="0 a 100"
            />
            <p className="text-xs text-slate-500 mt-1">0–100%</p>
          </div>

          <label className="flex items-end gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!!docPrincipal}
              onChange={(e) => setDocPrincipal(e.target.checked)}
            />
            <span className="text-sm">Principal</span>
          </label>
        </div>

        <div>
          <button
            onClick={addDoc}
            disabled={savingDoc || !docNumeroClean || docInvalido}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            title={docInvalido ? "Documento inválido" : ""}
          >
            {savingDoc ? "Salvando…" : "Adicionar documento"}
          </button>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">Tipo</th>
                <th className="p-2 border">Número</th>
                <th className="p-2 border">Principal</th>
                <th className="p-2 border">Percentual</th>
                <th className="p-2 border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center">Carregando…</td>
                </tr>
              )}
              {!loading &&
                docs.map((d) => (
                  <tr key={d.id}>
                    <td className="p-2 border">{d.id}</td>
                    <td className="p-2 border">{d.doc_tipo}</td>
                    <td className="p-2 border">
                      {d.doc_tipo === "CPF" ? formatCpf(d.doc_numero) : formatCnpj(d.doc_numero)}
                    </td>
                    <td className="p-2 border">{d.principal ? "Sim" : "Não"}</td>
                    <td className="p-2 border">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="border rounded px-2 py-1 w-20"
                        defaultValue={d.percentual_nf ?? 100}
                        onBlur={(e) => updatePercentual(d.id, Number(e.target.value))}
                        title="Edite e saia do campo para salvar"
                      /> %
                    </td>
                    <td className="p-2 border">
                      <button onClick={() => delDoc(d.id)} className="text-red-700 underline">
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    Nenhum documento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
