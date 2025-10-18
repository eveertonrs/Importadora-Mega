import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

// máscaras
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

// validações
const validateCPF = (cpf: string) => {
  const s = onlyDigits(cpf);
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  let sum = 0, rest = 0;
  for (let i = 1; i <= 9; i++) sum += parseInt(s.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11; if (rest >= 10) rest = 0;
  if (rest !== parseInt(s.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(s.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11; if (rest >= 10) rest = 0;
  return rest === parseInt(s.substring(10, 11));
};
const validateCNPJ = (cnpj: string) => {
  const s = onlyDigits(cnpj);
  if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
  const calc = (arr: number[]) => {
    let sum = 0;
    const w = arr.length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    arr.forEach((v, i) => (sum += v * w[i]));
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const n = s.split("").map(Number);
  const d1 = calc(n.slice(0, 12));
  const d2 = calc(n.slice(0, 12).concat(d1));
  return d1 === n[12] && d2 === n[13];
};

type Doc = {
  id: number;
  cliente_id: number;
  doc_tipo: "CNPJ" | "CPF";
  doc_numero: string;
  principal: boolean;
  // modelo_nota saiu da UI
  tipo_nota: "MEIA" | "INTEGRAL";
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
  const [tipoNota, setTipoNota] = useState<"INTEGRAL" | "MEIA">("INTEGRAL");

  const [savingDoc, setSavingDoc] = useState(false);
  const [errDoc, setErrDoc] = useState<string | null>(null);
  const [okDoc, setOkDoc] = useState<string | null>(null);

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

  function flash(msg: string, type: "ok" | "err" = "ok") {
    if (type === "ok") { setOkDoc(msg); setTimeout(() => setOkDoc(null), 2500); }
    else { setErrDoc(msg); setTimeout(() => setErrDoc(null), 3500); }
  }

  async function addDoc() {
    setSavingDoc(true);
    setErrDoc(null);
    try {
      await api.post(`/clientes/${id}/documentos`, {
        doc_tipo: docTipo,
        doc_numero: docNumeroClean,
        principal: !!docPrincipal,
        percentual_nf: Math.max(0, Math.min(100, percentual)),
        // modelo_nota removido do payload
        tipo_nota: tipoNota,
      });
      setDocNumeroRaw("");
      setPercentual(100);
      setTipoNota("INTEGRAL");
      setDocPrincipal(true);
      await load();
      flash("Documento adicionado!");
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 409
          ? "Documento já cadastrado para este cliente"
          : "Falha ao salvar documento.");
      flash(msg, "err");
    } finally {
      setSavingDoc(false);
    }
  }

  async function delDoc(docId: number) {
    if (!confirm("Remover este documento?")) return;
    try {
      await api.delete(`/clientes/${id}/documentos/${docId}`);
      await load();
      flash("Documento removido");
    } catch (e: any) {
      flash(e?.response?.data?.message || "Falha ao remover documento.", "err");
    }
  }

  async function updateField(docId: number, patch: Partial<Doc>, okMsg = "Atualizado") {
    try {
      await api.put(`/clientes/${id}/documentos/${docId}`, patch as any);
      await load();
      flash(okMsg);
    } catch (e: any) {
      flash(e?.response?.data?.message || "Falha ao atualizar.", "err");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => nav(-1)} className="px-3 py-2 rounded-xl border hover:bg-slate-50">
          ← Voltar
        </button>
        <h1 className="text-xl font-semibold">Documentos do cliente #{id}</h1>
      </div>

      <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-700">Documentos fiscais</h2>
          {okDoc && <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{okDoc}</span>}
        </div>

        {errDoc && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {errDoc}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Tipo</label>
            <select
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={docTipo}
              onChange={(e) => setDocTipo((e.target.value as "CNPJ" | "CPF") ?? "CNPJ")}
            >
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="text-sm flex items-center justify-between text-slate-600">
              <span>Número</span>
              {docNumeroClean && (
                <span
                  className={[
                    "text-xs px-1.5 py-0.5 rounded",
                    docInvalido ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
                  ].join(" ")}
                >
                  {docInvalido ? "Inválido" : "Válido"}
                </span>
              )}
            </label>
            <input
              className={[
                "mt-1 border rounded-xl px-3 py-2 w-full",
                docNumeroClean && docInvalido ? "border-rose-400 ring-rose-200" : "",
              ].join(" ")}
              value={docNumeroMasked}
              onChange={(e) => setDocNumeroRaw(e.target.value)}
              placeholder={docTipo === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              inputMode="numeric"
            />
            <p className="text-xs text-slate-500 mt-1">Digite apenas números; a máscara é automática.</p>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Percentual</label>
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={percentual}
              onChange={(e) => setPercentual(Number(e.target.value))}
              placeholder="0 a 100"
            />
            <p className="text-xs text-slate-500 mt-1">0–100%</p>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-slate-600">Tipo da nota</label>
            <select
              className="mt-1 border rounded-xl px-3 py-2 w-full"
              value={tipoNota}
              onChange={(e) => setTipoNota((e.target.value as "INTEGRAL" | "MEIA") ?? "INTEGRAL")}
            >
              <option value="INTEGRAL">INTEGRAL</option>
              <option value="MEIA">MEIA</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">Compatível com o CHECK do banco.</p>
          </div>

          <label className="md:col-span-12 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!!docPrincipal}
              onChange={(e) => setDocPrincipal(e.target.checked)}
            />
            <span className="text-sm">Definir como principal</span>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={addDoc}
            disabled={savingDoc || !docNumeroClean || docInvalido}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            title={docInvalido ? "Documento inválido" : ""}
          >
            {savingDoc ? "Salvando…" : "Adicionar documento"}
          </button>
          <button
            onClick={() => { setDocNumeroRaw(""); setPercentual(100); setTipoNota("INTEGRAL"); setDocPrincipal(true); }}
            className="px-3 py-2 rounded-xl border hover:bg-slate-50"
          >
            Limpar
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-left">
                <th className="p-2 border w-14">#</th>
                <th className="p-2 border w-20">Tipo</th>
                <th className="p-2 border">Número</th>
                <th className="p-2 border w-28">Principal</th>
                <th className="p-2 border w-28">Tipo (nota)</th>
                <th className="p-2 border w-40">Percentual</th>
                <th className="p-2 border w-28">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">Carregando…</td>
                </tr>
              )}

              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    Nenhum documento cadastrado. <span className="underline">Adicione o primeiro acima</span>.
                  </td>
                </tr>
              )}

              {!loading && docs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="p-2 border">{d.id}</td>
                  <td className="p-2 border">{d.doc_tipo}</td>
                  <td className="p-2 border">
                    {d.doc_tipo === "CPF" ? formatCpf(d.doc_numero) : formatCnpj(d.doc_numero)}
                  </td>

                  {/* principal */}
                  <td className="p-2 border">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name={`principal-${d.id}`}
                        checked={d.principal}
                        onChange={() => updateField(d.id, { principal: true }, "Definido como principal")}
                      />
                      <span>{d.principal ? "Sim" : "Não"}</span>
                    </label>
                  </td>

                  {/* tipo_nota (inline) */}
                  <td className="p-2 border">
                    <select
                      className="border rounded-lg px-2 py-1"
                      defaultValue={d.tipo_nota || "INTEGRAL"}
                      onBlur={(e) => {
                        const v = (e.currentTarget.value as "INTEGRAL" | "MEIA");
                        if (v !== (d.tipo_nota || "INTEGRAL")) updateField(d.id, { tipo_nota: v });
                      }}
                    >
                      <option value="INTEGRAL">INTEGRAL</option>
                      <option value="MEIA">MEIA</option>
                    </select>
                  </td>

                  {/* percentual (inline) */}
                  <td className="p-2 border">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="border rounded-lg px-2 py-1 w-24"
                        defaultValue={d.percentual_nf ?? 100}
                        onBlur={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.currentTarget.value)));
                          if (val !== (d.percentual_nf ?? 100)) updateField(d.id, { percentual_nf: val });
                        }}
                        title="Edite e saia do campo para salvar"
                      />
                      <span>%</span>
                    </div>
                  </td>

                  <td className="p-2 border">
                    <button onClick={() => delDoc(d.id)} className="text-red-700 hover:underline">
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
