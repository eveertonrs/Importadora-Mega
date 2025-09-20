import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

type Cliente = {
  id: number;
  nome_fantasia: string;
  tabela_preco?: string | null;
  whatsapp?: string | null;
  anotacoes?: string | null;
  status?: "ATIVO" | "INATIVO";
};

const Badge = ({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "danger" }) => (
  <span
    className={[
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      tone === "success" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      tone === "danger" && "bg-red-50 text-red-700 ring-1 ring-red-200",
      tone === "neutral" && "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
    ].join(" ")}
  >
    {children}
  </span>
);

export default function ClienteDetalhes() {
  const { id } = useParams();
  const nav = useNavigate();
  const [cli, setCli] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(`/clientes/${id}`);
      setCli(data);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Falha ao carregar cliente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const tabelaLabel = (t?: string | null) =>
    t ? t.toString().replaceAll("_", " ").toUpperCase() : "-";

  return (
    <div className="space-y-4">
      {/* barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav(-1)}
            className="px-3 py-2 rounded border hover:bg-slate-50"
          >
            ← Voltar
          </button>
          <h1 className="text-lg font-semibold">
            Cliente <span className="text-slate-500">#{id}</span>
          </h1>
          {cli?.status && (
            <Badge tone={cli.status === "ATIVO" ? "success" : "danger"}>
              {cli.status}
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Link
            to={`/clientes/${id}/documentos`}
            className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Documentos
          </Link>
          <Link
            to={`/blocos?cliente=${id}`}
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Blocos
          </Link>
        </div>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="rounded border p-4 bg-white">
        <h2 className="font-semibold text-base mb-3">Dados do cliente</h2>

        {loading && <div className="text-sm text-slate-500">Carregando…</div>}

        {cli && !loading && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div>
                <div className="text-xs text-slate-500">Nome fantasia</div>
                <div className="font-medium">{cli.nome_fantasia}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">WhatsApp</div>
                <div className="font-medium">
                  {cli.whatsapp ? (
                    <a
                      href={`https://wa.me/${cli.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {cli.whatsapp}
                    </a>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Anotações</div>
                <div className="font-medium break-words">
                  {cli.anotacoes || <span className="text-slate-500">—</span>}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-slate-500">Tabela de preço</div>
                <div className="font-medium">{tabelaLabel(cli.tabela_preco)}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div>
                  <Badge tone={cli.status === "ATIVO" ? "success" : "danger"}>
                    {cli.status ?? "—"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
