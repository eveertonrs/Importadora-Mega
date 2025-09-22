// src/components/ClienteDetalhes.tsx
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

const Badge = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger";
}) => (
  <span
    className={[
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
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
  const [saving, setSaving] = useState(false);

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
    t ? t.toString().replaceAll("_", " ").toUpperCase() : "—";

  async function toggleStatus() {
    if (!cli) return;
    setSaving(true);
    try {
      await api.put(`/clientes/${id}`, {
        status: cli.status === "ATIVO" ? "INATIVO" : "ATIVO",
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao atualizar status.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!confirm("Confirmar exclusão (inativação) do cliente?")) return;
    setSaving(true);
    try {
      await api.delete(`/clientes/${id}`);
      alert("Cliente inativado.");
      nav("/clientes");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao excluir.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="px-3 py-2 rounded border hover:bg-slate-50">
            ← Voltar
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              Cliente <span className="text-slate-500">#{id}</span>
            </h1>
            {cli?.status && (
              <Badge tone={cli.status === "ATIVO" ? "success" : "danger"}>{cli.status}</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/clientes/${id}/documentos`}
            className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Documentos
          </Link>
          <Link
            to={`/clientes/${id}/editar`}
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Editar
          </Link>
          <button
            onClick={toggleStatus}
            disabled={saving}
            className="px-3 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            title="Ativar/Inativar"
          >
            {cli?.status === "ATIVO" ? "Inativar" : "Reativar"}
          </button>
          <button
            onClick={excluir}
            disabled={saving}
            className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Excluir
          </button>
          <Link
            to={`/blocos?cliente=${id}`}
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Abrir blocos
          </Link>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Card principal */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold mb-4">Dados do cliente</h2>

        {/* Skeleton */}
        {loading && (
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 bg-slate-100 animate-pulse rounded" />
                <div className="h-4 w-48 bg-slate-100 animate-pulse rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && cli && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Coluna esquerda */}
            <div className="space-y-4">
              <Info item="Nome fantasia" value={cli.nome_fantasia || "—"} />
              <Info
                item="WhatsApp"
                value={
                  cli.whatsapp ? (
                    <a
                      href={`https://wa.me/${cli.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {cli.whatsapp}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <div>
                <div className="text-xs text-slate-500">Anotações</div>
                <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {cli.anotacoes || <span className="text-slate-500">—</span>}
                </div>
              </div>
            </div>

            {/* Coluna direita */}
            <div className="space-y-4">
              <Info item="Tabela de preço" value={tabelaLabel(cli.tabela_preco)} />
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="mt-1">
                  <Badge tone={cli.status === "ATIVO" ? "success" : "danger"}>
                    {cli.status ?? "—"}
                  </Badge>
                </div>
              </div>

              {/* Ações rápidas secundárias */}
              <div className="rounded-lg border p-3">
                <div className="text-xs text-slate-500 mb-2">Ações rápidas</div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/clientes/${id}/editar`}
                    className="px-3 py-1.5 rounded border hover:bg-slate-50"
                  >
                    Editar dados
                  </Link>
                  <Link
                    to={`/clientes/${id}/documentos`}
                    className="px-3 py-1.5 rounded border hover:bg-slate-50"
                  >
                    Documentos
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Componente de linha de informação (rótulo + valor) */
function Info({ item, value }: { item: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{item}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
