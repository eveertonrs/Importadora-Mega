import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

/* ===================== Tipos ===================== */
type Cliente = {
  id: number;
  nome_fantasia: string;
  whatsapp?: string | null;
  anotacoes?: string | null;
  tabela_preco?: string | null;
  status?: "ATIVO" | "INATIVO";
  ativo?: boolean;
};

type Doc = {
  id: number;
  doc_tipo: "CNPJ" | "CPF" | string;
  doc_numero: string;
  principal?: boolean;
  modelo_nota?: string | null;
};

type TranspVinculada = {
  cliente_id: number;
  transportadora_id: number;
  principal: boolean;
  observacao?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
};

type Transportadora = {
  id: number;
  nome?: string | null;
  nome_fantasia?: string | null;
  razao_social?: string | null;
  status?: "ATIVO" | "INATIVO";
};

/* ===================== Utils ===================== */
const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const nomeTransp = (t: { nome_fantasia?: string | null; razao_social?: string | null; nome?: string | null }) =>
  (t?.nome_fantasia || t?.razao_social || t?.nome || "").trim();

/* ===================== Componente ===================== */
export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [cli, setCli] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  const [saldo, setSaldo] = useState<number | null>(null);
  const [saldoLoading, setSaldoLoading] = useState(false);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // vínculos
  const [vLoading, setVLoading] = useState(false);
  const [vRows, setVRows] = useState<TranspVinculada[]>([]);
  const [vErr, setVErr] = useState<string | null>(null);

  // modal associar
  const [openAssoc, setOpenAssoc] = useState(false);
  const [listaTransp, setListaTransp] = useState<Transportadora[]>([]);
  const [selTransp, setSelTransp] = useState<number | "">("");
  const [selPrincipal, setSelPrincipal] = useState(true);
  const [assocSaving, setAssocSaving] = useState(false);

  // carrega cliente
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/clientes/${id}`);
        if (cancel) return;

        const raw = (data?.data ?? data) as any;
        const status: "ATIVO" | "INATIVO" =
          (raw?.status as any) || (raw?.ativo ? "ATIVO" : "INATIVO") || "ATIVO";

        setCli({
          id: Number(raw.id),
          nome_fantasia: raw.nome_fantasia ?? "",
          whatsapp: raw.whatsapp ?? null,
          anotacoes: raw.anotacoes ?? null,
          tabela_preco: raw.tabela_preco ?? null,
          status,
          ativo: status === "ATIVO",
        });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  // saldo
  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      try {
        setSaldoLoading(true);
        const { data } = await api.get(`/clientes/${id}/saldo`, { headers: { "x-silent": "1" } });
        if (cancel) return;
        const v = Number(data?.saldo ?? data ?? 0);
        setSaldo(Number.isFinite(v) ? v : 0);
      } catch {
        if (!cancel) setSaldo(0);
      } finally {
        if (!cancel) setSaldoLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  // documentos
  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      try {
        setDocsLoading(true);
        const { data } = await api.get(`/clientes/${id}/documentos`, { headers: { "x-silent": "1" } });
        if (cancel) return;
        setDocs((data?.documentos ?? data?.data ?? []) as Doc[]);
      } catch {
        if (!cancel) setDocs([]);
      } finally {
        if (!cancel) setDocsLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  // vínculos de transportadoras do cliente
  async function loadVinculos() {
    if (!id) return;
    setVLoading(true);
    setVErr(null);
    try {
      const { data } = await api.get(`/clientes/${id}/transportadoras`);
      setVRows((data?.data ?? data ?? []) as TranspVinculada[]);
    } catch (e: any) {
      setVErr(e?.response?.data?.message || "Falha ao carregar transportadoras do cliente.");
      setVRows([]);
    } finally {
      setVLoading(false);
    }
  }
  useEffect(() => { loadVinculos(); }, [id]);

  // opções de transportadoras (para o modal)
  useEffect(() => {
    if (!openAssoc) return;
    (async () => {
      try {
        const { data } = await api.get("/transportadoras", {
          params: { status: "ATIVO", limit: 999 },
          headers: { "x-silent": "1" },
        });
        setListaTransp(data?.data ?? data ?? []);
      } catch {
        setListaTransp([]);
      }
    })();
  }, [openAssoc]);

  const isAtivo = cli?.status === "ATIVO" || cli?.ativo;

  const saldoTone = useMemo(() => {
    if (saldo === null) return "from-slate-100 to-slate-50 ring-slate-200 text-slate-700";
    if ((saldo ?? 0) > 0) return "from-emerald-50 to-emerald-100 ring-emerald-200 text-emerald-800";
    if ((saldo ?? 0) < 0) return "from-rose-50 to-rose-100 ring-rose-200 text-rose-800";
    return "from-slate-50 to-white ring-slate-200 text-slate-700";
  }, [saldo]);

  /* ---------- Loading skeleton ---------- */
  if (loading || !cli) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-9 w-24 rounded-xl border bg-white" />
          <div className="h-6 w-64 rounded bg-slate-200" />
          <div className="ml-auto h-12 w-64 rounded-2xl bg-slate-100" />
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2 h-72 rounded-2xl border bg-white" />
          <div className="space-y-5">
            <div className="h-40 rounded-2xl border bg-white" />
            <div className="h-40 rounded-2xl border bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          className="group inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-slate-50"
          onClick={() => nav(-1)}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium group-hover:translate-x-[-1px] transition-transform">Voltar</span>
        </button>

        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">
            {cli.nome_fantasia?.toUpperCase()} <span className="text-slate-400">#{cli.id}</span>
          </h1>
          <div className="mt-1">
            {isAtivo ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 ring-1 ring-emerald-200">
                ✓ ATIVO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 text-slate-700 text-[11px] px-2 py-0.5">
                × INATIVO
              </span>
            )}
          </div>
        </div>

        {/* SALDO à direita */}
        <div
          className={`ml-auto inline-flex items-center gap-3 rounded-2xl bg-gradient-to-br px-4 py-3 ring-1 ${saldoTone} shadow-sm`}
          title="Saldo acumulado do cliente (positivo = crédito; negativo = débito)"
        >
          <div className="flex flex-col">
            <span className="text-xs/4 text-slate-600">Saldo do cliente</span>
            <span className="text-2xl font-bold tracking-tight">
              {saldoLoading ? "calculando…" : formatBRL(saldo ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Dados do cliente */}
        <div className="md:col-span-2 rounded-2xl border p-5 shadow-sm bg-white">
          <h2 className="text-sm font-medium text-slate-600 mb-4">Dados do cliente</h2>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Nome fantasia</div>
              <div className="font-medium">{cli.nome_fantasia}</div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Tabela de preço</div>
              <div className="font-medium">{cli.tabela_preco || "—"}</div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500">WhatsApp</div>
              {cli.whatsapp ? (
                <a
                  className="inline-flex items-center gap-2 text-blue-700 underline decoration-1 underline-offset-2 hover:text-blue-800"
                  href={`https://wa.me/${cli.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {cli.whatsapp}
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z" />
                    <path d="M5 5h5V3H3v7h2V5z" />
                  </svg>
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Status</div>
              <div className="font-medium">{isAtivo ? "ATIVO" : "INATIVO"}</div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">Anotações</div>
              <p className="text-slate-700 whitespace-pre-line">
                {cli.anotacoes?.trim() ? cli.anotacoes : <span className="text-slate-400">—</span>}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to={`/clientes/${cli.id}/editar`}
              className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 transition-colors"
            >
              Editar dados
            </Link>
            <Link
              to={`/clientes/${cli.id}/documentos`}
              className="px-3 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              Gerenciar documentos
            </Link>
            <Link
              to={`/blocos?cliente_id=${cli.id}`}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              Abrir blocos
            </Link>
          </div>
        </div>

        {/* Lateral direita */}
        <div className="space-y-5">
          {/* Documentos */}
          <div className="rounded-2xl border p-4 bg-white shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-600">Documentos fiscais</h3>
              <Link
                to={`/clientes/${cli.id}/documentos`}
                className="text-xs px-2 py-1 rounded border hover:bg-slate-50"
              >
                + adicionar / editar
              </Link>
            </div>

            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2 border">Tipo</th>
                    <th className="p-2 border">Número</th>
                    <th className="p-2 border">Principal</th>
                    <th className="p-2 border">% Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {docsLoading && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-500">Carregando…</td>
                    </tr>
                  )}
                  {!docsLoading && docs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-400">Nenhum documento</td>
                    </tr>
                  )}
                  {!docsLoading &&
                    docs.map((d) => (
                      <tr key={d.id}>
                        <td className="p-2 border">{d.doc_tipo}</td>
                        <td className="p-2 border">{d.doc_numero}</td>
                        <td className="p-2 border">{d.principal ? "Sim" : "Não"}</td>
                        <td className="p-2 border">{d.modelo_nota ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transportadoras vinculadas */}
          <div className="rounded-2xl border p-4 bg-white shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-600">Transportadoras associadas</h3>
              <button
                type="button"
                onClick={() => { setSelTransp(""); setSelPrincipal(true); setOpenAssoc(true); }}
                className="text-xs px-2 py-1 rounded border hover:bg-slate-50"
              >
                + associar
              </button>
            </div>

            {vLoading ? (
              <div className="text-sm text-slate-500">Carregando…</div>
            ) : vErr ? (
              <div className="text-sm text-red-700">{vErr}</div>
            ) : vRows.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhuma transportadora associada.</div>
            ) : (
              <ul className="space-y-2">
                {vRows.map((r) => (
                  <li key={r.transportadora_id} className="flex items-center justify-between rounded border px-3 py-2 bg-slate-50/50 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ${
                        r.principal ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200"
                      }`}>
                        {r.principal ? "PRINCIPAL" : "VÍNCULO"}
                      </span>
                      <div className="truncate">
                        <div className="font-medium truncate">{nomeTransp(r) || `#${r.transportadora_id}`}</div>
                        {r.cnpj && <div className="text-xs text-slate-500 truncate">{r.cnpj}</div>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!r.principal && (
                        <button
                          onClick={async () => {
                            await api.patch(`/clientes/${cli.id}/transportadoras/${r.transportadora_id}`, { principal: true });
                            await loadVinculos();
                          }}
                          className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Tornar principal
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm("Remover vínculo desta transportadora?")) return;
                          await api.delete(`/clientes/${cli.id}/transportadoras/${r.transportadora_id}`);
                          await loadVinculos();
                        }}
                        className="rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Modal associar transportadora */}
      {openAssoc && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => !assocSaving && setOpenAssoc(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold">Associar transportadora</h4>
              <button className="rounded-md border px-2 py-1 text-sm" onClick={() => !assocSaving && setOpenAssoc(false)}>Fechar</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600">Transportadora</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={selTransp}
                  onChange={(e) => setSelTransp(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Selecione…</option>
                  {listaTransp.map((t) => (
                    <option key={t.id} value={t.id}>{nomeTransp(t)}</option>
                  ))}
                </select>
                {listaTransp.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">Nenhuma transportadora ativa disponível.</p>
                )}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selPrincipal}
                  onChange={(e) => setSelPrincipal(e.target.checked)}
                />
                <span className="text-sm">Definir como principal</span>
              </label>

              <div className="pt-1">
                <button
                  disabled={!selTransp || assocSaving}
                  onClick={async () => {
                    if (!selTransp) return;
                    setAssocSaving(true);
                    try {
                      await api.post(`/clientes/${cli.id}/transportadoras`, {
                        transportadora_id: selTransp,
                        principal: selPrincipal,
                      });
                      setOpenAssoc(false);
                      await loadVinculos();
                    } catch (e: any) {
                      alert(e?.response?.data?.message || "Falha ao associar.");
                    } finally {
                      setAssocSaving(false);
                    }
                  }}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {assocSaving ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
