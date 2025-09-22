// src/components/ClienteDocumentoForm.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

type Doc = {
  id: number;
  cliente_id: number;
  doc_tipo: "CNPJ" | "CPF";
  doc_numero: string;
  principal: boolean;
  modelo_nota?: string | null;
  nome?: string | null;
  tipo_nota?: string | null;
};

type LinkItem = { descricao: string; url: string };

export default function ClienteDocumentoForm() {
  const { id } = useParams(); // cliente_id
  const nav = useNavigate();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(false);

  // form doc
  const [docTipo, setDocTipo] = useState<"CNPJ" | "CPF">("CNPJ");
  const [docNumero, setDocNumero] = useState("");
  const [docPrincipal, setDocPrincipal] = useState(true);
  const [savingDoc, setSavingDoc] = useState(false);
  const [errDoc, setErrDoc] = useState<string | null>(null);

  // form link
  const [linkDesc, setLinkDesc] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [errLink, setErrLink] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/clientes/${id}/documentos`);
      setDocs(data?.documentos ?? []);
      setLinks(data?.links ?? []);
    } catch (e: any) {
      // silencia na primeira carga
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function addDoc() {
    setSavingDoc(true);
    setErrDoc(null);
    try {
      await api.post(`/clientes/${id}/documentos`, {
        doc_tipo: docTipo,
        doc_numero: docNumero.trim(),
        principal: !!docPrincipal,
      });
      setDocNumero("");
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

  async function addLink() {
    setSavingLink(true);
    setErrLink(null);
    try {
      await api.post(`/clientes/${id}/documentos`, {
        descricao: linkDesc.trim(),
        url: linkUrl.trim(),
      });
      setLinkDesc("");
      setLinkUrl("");
      await load();
    } catch (e: any) {
      setErrLink(e?.response?.data?.message || "Falha ao anexar link.");
    } finally {
      setSavingLink(false);
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

      {/* DOCUMENTOS */}
      <div className="rounded border bg-white p-4 space-y-3">
        <h2 className="font-medium">Documentos fiscais</h2>

        {errDoc && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {errDoc}
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-3">
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
            <label className="text-sm">Número</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={docNumero}
              onChange={(e) => setDocNumero(e.target.value)}
              placeholder={docTipo === "CNPJ" ? "12.345.678/0001-99" : "000.000.000-00"}
            />
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
            disabled={savingDoc || !docNumero.trim()}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
                <th className="p-2 border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="p-4 text-center">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading &&
                docs.map((d) => (
                  <tr key={d.id}>
                    <td className="p-2 border">{d.id}</td>
                    <td className="p-2 border">{d.doc_tipo}</td>
                    <td className="p-2 border">{d.doc_numero}</td>
                    <td className="p-2 border">{d.principal ? "Sim" : "Não"}</td>
                    <td className="p-2 border">
                      <button
                        onClick={() => delDoc(d.id)}
                        className="text-red-700 underline"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">
                    Nenhum documento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LINKS */}
      <div className="rounded border bg-white p-4 space-y-3">
        <h2 className="font-medium">Links úteis (anexos)</h2>

        {errLink && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {errLink}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm">Descrição</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="Portal do cliente / Pasta Drive..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">URL</label>
            <input
              className="mt-1 border rounded px-3 py-2 w-full"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <button
            onClick={addLink}
            disabled={savingLink || !linkDesc.trim() || !linkUrl.trim()}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingLink ? "Salvando…" : "Adicionar link"}
          </button>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 border">Descrição</th>
                <th className="p-2 border">URL</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l, i) => (
                <tr key={`${l.url}-${i}`}>
                  <td className="p-2 border">{l.descricao}</td>
                  <td className="p-2 border">
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                      {l.url}
                    </a>
                  </td>
                </tr>
              ))}
              {links.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-slate-500">
                    Nenhum link
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
