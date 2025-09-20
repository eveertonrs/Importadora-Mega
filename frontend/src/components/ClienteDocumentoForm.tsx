// src/components/ClienteDocumentoForm.tsx
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

type Props = { clienteId?: string };

export default function ClienteDocumentoForm({ clienteId: propId }: Props) {
  const params = useParams();
  const id = propId ?? params.id ?? "";
  const nav = useNavigate();

  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const urlValida = useMemo(() => {
    if (!url) return false;
    try {
      const u = new URL(url);
      return /^https?:/.test(u.protocol);
    } catch {
      return false;
    }
  }, [url]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!descricao.trim()) return setErr("Informe a descrição.");
      if (!urlValida) return setErr("Informe uma URL válida (http/https).");

      setLoading(true);
      setErr(null);
      try {
        await api.post(`/clientes/${id}/documentos`, {
          descricao: descricao.trim(),
          url: url.trim(),
        });
        setOk(true);
        // pequena pausa para o usuário ver o feedback
        setTimeout(() => nav(`/clientes/${id}`), 400);
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Falha ao salvar o documento.");
      } finally {
        setLoading(false);
      }
    },
    [descricao, url, id, nav, urlValida]
  );

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => nav(-1)}
          className="px-3 py-2 rounded-md border hover:bg-slate-50"
        >
          ← Voltar
        </button>
        <h1 className="text-xl font-semibold">
          Novo documento — Cliente <span className="text-slate-500">#{id}</span>
        </h1>
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {err}
          </div>
        )}
        {ok && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
            Documento salvo com sucesso!
          </div>
        )}

        <div>
          <label className="text-sm text-slate-600">Descrição</label>
          <input
            className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="ex.: Contrato social, comprovante, etc."
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm text-slate-600">URL (Drive / link)</label>
          <input
            className={`mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 ${
              url.length === 0
                ? "focus:ring-blue-200"
                : urlValida
                ? "focus:ring-emerald-200"
                : "focus:ring-red-200"
            }`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
          {url && (
            <div className="mt-2 text-xs">
              {urlValida ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Abrir link em nova aba ↗
                </a>
              ) : (
                <span className="text-red-600">URL inválida</span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            title="Ctrl+Enter para salvar"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit(e as any);
            }}
          >
            {loading ? "Enviando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-4 py-2 bg-slate-100 rounded-md hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
