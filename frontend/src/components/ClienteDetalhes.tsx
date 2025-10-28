import { useEffect, useState, useMemo } from "react";
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
  percentual_nf?: number | null;
  tipo_nota?: "MEIA" | "INTEGRAL";
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

const copy = async (s: string) => {
  try {
    await navigator.clipboard.writeText(s);
  } catch {
    /* ignore */
  }
};

const toneOf = (v: number) => {
  if ((v ?? 0) > 0) return "from-emerald-50 to-emerald-100 ring-emerald-200 text-emerald-800";
  if ((v ?? 0) < 0) return "from-rose-50 to-rose-100 ring-rose-200 text-rose-800";
  return "from-slate-50 to-white ring-slate-200 text-slate-700";
};

// máscaras rápidas
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
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
const formatDoc = (tipo?: string, num?: string) =>
  !num ? "—" : tipo === "CPF" ? formatCpf(num) : tipo === "CNPJ" ? formatCnpj(num) : num;

/** Formata WhatsApp BR (aceita com/sem +55) */
function formatWhatsApp(raw?: string | null) {
  if (!raw) return "";
  const digits = onlyDigits(String(raw));
  if (!digits) return "";

  let cc = "";
  let ddd = "";
  let num = "";

  if (digits.startsWith("55") && digits.length >= 12) {
    cc = "+55 ";
    ddd = digits.slice(2, 4);
    num = digits.slice(4);
  } else {
    ddd = digits.slice(0, 2);
    num = digits.slice(2);
  }

  if (num.length === 9) return `${cc}(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  if (num.length === 8) return `${cc}(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  return `${cc}(${ddd}) ${num}`;
}

/** Telefone BR genérico (para transportadoras) */
function formatPhoneBR(raw?: string | null) {
  if (!raw) return "";
  const digits = onlyDigits(String(raw));
  if (!digits) return "";

  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const num = local.slice(2);

  if (num.length === 9) return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  if (num.length === 8) return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  return local; // fallback
}

/** Regras do card Financeiro:
 *  Financeiro = débito do(s) bloco(s) aberto(s) + A Receber
 *  débito do bloco = apenas a parte negativa do saldo_do_bloco (positivo não entra)
 */
const calcularFinanceiro = (saldoBloco: number, aReceber: number) =>
  Math.max(0, -Number(saldoBloco || 0)) + Number(aReceber || 0);

/* ===================== Componente ===================== */
export default function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  // ===== papel do usuário (admin x administrativo) =====
  const role: string | undefined = useMemo(() => {
    try {
      const keys = ["auth_user", "auth", "user", "megafin:auth"];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (obj?.user?.permissao) return String(obj.user.permissao);
        if (obj?.permissao) return String(obj.permissao);
      }
    } catch {}
    return undefined;
  }, []);
  const hideFinancialCards = role === "administrativo"; // <- regra pedida

  const [cli, setCli] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  // saldos (consolidados por cliente — independem da qtde de blocos)
  const [saldoBloco, setSaldoBloco] = useState<number>(0);
  const [financeiro, setFinanceiro] = useState<number>(0);
  const [aReceber, setAReceber] = useState<number>(0);
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
  const [filtroTransp, setFiltroTransp] = useState("");
  const [selTransp, setSelTransp] = useState<number | "">("");
  const [selPrincipal, setSelPrincipal] = useState(true);
  const [assocSaving, setAssocSaving] = useState(false);

  /* ---------- Carrega cliente ---------- */
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

        if (typeof raw?.a_receber === "number") setAReceber(Number(raw.a_receber || 0));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  /* ---------- Saldos ---------- */
  async function recarregarSaldos() {
    if (!id) return;
    try {
      setSaldoLoading(true);
      const { data } = await api.get(`/clientes/${id}/saldo`, { headers: { "x-silent": "1" } });

      const sb = Number(data?.saldo_bloco ?? 0);
      const ar = Number(data?.a_receber ?? 0);

      setSaldoBloco(sb);
      setAReceber(ar);

      // regra da tela
      setFinanceiro(calcularFinanceiro(sb, ar));
    } catch {
      setSaldoBloco(0);
      setFinanceiro(0);
      setAReceber(0);
    } finally {
      setSaldoLoading(false);
    }
  }
  useEffect(() => {
    recarregarSaldos();
  }, [id]);

  /* ---------- Documentos ---------- */
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
    return () => {
      cancel = true;
    };
  }, [id]);

  /* ---------- Vínculos de transportadoras ---------- */
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
  useEffect(() => {
    loadVinculos();
  }, [id]);

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

  /* ---------- Loading skeleton ---------- */
  if (loading || !cli) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-3xl bg-slate-200/50" />
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

  /* ---------- UI ---------- */
  const opcoesTranspFiltradas = listaTransp.filter((t) =>
    nomeTransp(t).toLowerCase().includes(filtroTransp.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white p-6 shadow">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg bg-white/10 px-3 py-1.5 ring-1 ring-white/30 hover:bg-white/20"
                onClick={() => nav(-1)}
                title="Voltar"
              >
                ← Voltar
              </button>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] ring-1 " +
                  (isAtivo
                    ? "bg-emerald-500/10 text-emerald-200 ring-emerald-300/30"
                    : "bg-white/10 text-white ring-white/30")
                }
              >
                {isAtivo ? "ATIVO" : "INATIVO"}
              </span>
            </div>

            <h1 className="mt-2 truncate text-2xl font-semibold">
              {cli.nome_fantasia} <span className="text-slate-300">#{cli.id}</span>
            </h1>
          </div>

          {/* Cards */}
          <div className={`grid gap-3 min-w-[28rem] ${hideFinancialCards ? "grid-cols-1" : "grid-cols-3"}`}>
            {/* Saldo do bloco - SEMPRE visível */}
            <div
              className={`rounded-2xl bg-gradient-to-br px-4 py-3 ring-1 ${toneOf(
                saldoBloco
              )} shadow-sm`}
              title="Soma de todas as movimentações dos blocos ABERTOS (SAÍDA + / ENTRADA −), ignorando cancelados."
            >
              <div className="text-xs text-slate-700/80">Saldo do bloco</div>
              <div className="text-2xl font-bold tracking-tight">
                {saldoLoading ? "calculando…" : formatBRL(saldoBloco)}
              </div>
            </div>

            {/* Financeiro - apenas para quem NÃO é 'administrativo' */}
            {!hideFinancialCards && (
              <div
                className={`rounded-2xl bg-gradient-to-br px-4 py-3 ring-1 ${toneOf(
                  financeiro
                )} shadow-sm`}
                title="(Regra da tela) Financeiro = débito do bloco (se negativo) + A Receber."
              >
                <div className="text-xs text-slate-700/80">Financeiro</div>
                <div className="text-2xl font-bold tracking-tight">
                  {saldoLoading ? "…" : formatBRL(financeiro)}
                </div>
              </div>
            )}

            {/* A receber - apenas para quem NÃO é 'administrativo' */}
            {!hideFinancialCards && (
              <div
                className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 ring-1 ring-amber-200 text-amber-900 px-4 py-3 shadow-sm"
                title="TODOS os títulos do cliente em ABERTO/PARCIAL (qualquer bloco)."
              >
                <div className="text-xs">A receber</div>
                <div className="text-2xl font-bold tracking-tight">
                  {saldoLoading ? "…" : formatBRL(aReceber)}
                </div>
              </div>
            )}

            <button
              onClick={recarregarSaldos}
              className={`mt-1 rounded-xl bg-white/10 px-3 py-1.5 text-white ring-1 ring-white/30 hover:bg-white/20 ${hideFinancialCards ? "col-span-1" : "col-span-3"}`}
              title="Recarregar saldos"
            >
              ↻ Atualizar saldos
            </button>
          </div>
        </div>
      </section>

      {/* GRID PRINCIPAL */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Dados do cliente */}
        <div className="md:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-slate-600">Dados do cliente</h2>

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
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-slate-700" title="WhatsApp">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path d="M20.52 3.48A11 11 0 0 0 3.3 18.56L2 22l3.56-1.26A11 11 0 1 0 20.52 3.48Zm-8.1 16.06a9.1 9.1 0 0 1-4.64-1.27l-.33-.2-2.06.73.71-2.01-.22-.34a9.08 9.08 0 1 1 6.54 3.09ZM17 14.3c-.1-.15-.39-.24-.82-.43s-.51-.16-.73.13-.28.41-.52.37a6.2 6.2 0 0 1-2.93-1.8 3.38 3.38 0 0 1-.73-1.25c-.08-.25 0-.38.29-.64s.33-.39.49-.65.08-.46 0-.65c-.14-.24-.73-1.77-1-2.42s-.56-.56-.77-.57h-.65a1.25 1.25 0 0 0-.9.42 3.79 3.79 0 0 0-1.2 2.82 6.6 6.6 0 0 0 1.38 3.46 7.58 7.58 0 0 0 3.4 2.77 7.54 7.54 0 0 0 3.6.83c.37 0 .74-.06 1.1-.11a2.54 2.54 0 0 0 1.72-1.18 2.1 2.1 0 0 0 .15-1.15Z" />
                    </svg>
                    {formatWhatsApp(cli.whatsapp)}
                  </span>
                  <button
                    className="text-xs rounded border px-2 py-1 hover:bg-slate-50"
                    onClick={() => copy(onlyDigits(cli.whatsapp!))}
                    title="Copiar"
                  >
                    Copiar
                  </button>
                </div>
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
              <p className="whitespace-pre-line text-slate-700">
                {cli.anotacoes?.trim() ? cli.anotacoes : <span className="text-slate-400">—</span>}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to={`/clientes/${cli.id}/editar`}
              className="rounded-xl border bg-white px-3 py-2 transition-colors hover:bg-slate-50"
            >
              Editar dados
            </Link>
            <Link
              to={`/clientes/${cli.id}/documentos`}
              className="rounded-xl bg-violet-600 px-3 py-2 text-white transition-colors hover:bg-violet-700"
            >
              Gerenciar documentos
            </Link>
            <Link
              to={`/blocos?cliente_id=${cli.id}`}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-white transition-colors hover:bg-emerald-700"
            >
              Abrir blocos
            </Link>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          {/* Documentos fiscais */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-600">Documentos fiscais</h3>
              <Link to={`/clientes/${cli.id}/documentos`} className="text-xs rounded border px-2 py-1 hover:bg-slate-50">
                + adicionar / editar
              </Link>
            </div>

            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border p-2">Tipo</th>
                    <th className="border p-2">Número</th>
                    <th className="border p-2">Principal</th>
                    <th className="border p-2">Percentual</th>
                  </tr>
                </thead>
                <tbody>
                  {docsLoading && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-500">
                        Carregando…
                      </td>
                    </tr>
                  )}
                  {!docsLoading && docs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-400">
                        Nenhum documento
                      </td>
                    </tr>
                  )}
                  {!docsLoading &&
                    docs.map((d) => (
                      <tr key={d.id}>
                        <td className="border p-2">{d.doc_tipo}</td>
                        <td className="border p-2">
                          <button
                            className="underline decoration-1 underline-offset-2 hover:text-blue-700"
                            title="Copiar"
                            onClick={() => copy(onlyDigits(d.doc_numero))}
                          >
                            {formatDoc(d.doc_tipo, d.doc_numero)}
                          </button>
                        </td>
                        <td className="border p-2">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 " +
                              (d.principal
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-slate-50 text-slate-600 ring-slate-200")
                            }
                          >
                            {d.principal ? "SIM" : "NÃO"}
                          </span>
                        </td>
                        <td className="border p-2">
                          {typeof d.percentual_nf === "number" ? `${d.percentual_nf}%` : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transportadoras associadas */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-600">Transportadoras associadas</h3>
              <button
                type="button"
                onClick={() => {
                  setSelTransp("");
                  setSelPrincipal(true);
                  setFiltroTransp("");
                  setOpenAssoc(true);
                }}
                className="text-xs rounded border px-2 py-1 hover:bg-slate-50"
              >
                + associar
              </button>
            </div>

            {vLoading ? (
              <div className="text-sm text-slate-500">Carregando…</div>
            ) : vErr ? (
              <div className="text-sm text-rose-700">{vErr}</div>
            ) : vRows.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhuma transportadora associada.</div>
            ) : (
              <ul className="space-y-2">
                {vRows.map((r) => {
                  const sec =
                    r.cnpj ? formatCnpj(r.cnpj) : r.telefone ? formatPhoneBR(r.telefone) : "—";
                  return (
                    <li
                      key={r.transportadora_id}
                      className="flex items-center justify-between rounded border bg-slate-50/60 px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 " +
                            (r.principal
                              ? "bg-amber-50 text-amber-700 ring-amber-200"
                              : "bg-slate-50 text-slate-600 ring-slate-200")
                          }
                          title={r.principal ? "Transportadora principal" : "Vínculo"}
                        >
                          {r.principal ? "PRINCIPAL" : "VÍNCULO"}
                        </span>
                        <div className="truncate">
                          <div className="truncate font-medium">{nomeTransp(r) || `#${r.transportadora_id}`}</div>
                          <div className="truncate text-xs text-slate-500">{sec}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!r.principal && (
                          <button
                            onClick={async () => {
                              await api.patch(
                                `/clientes/${cli.id}/transportadoras/${r.transportadora_id}`,
                                { principal: true }
                              );
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
                          className="rounded border px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Modal associar transportadora */}
      {openAssoc && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onClick={() => !assocSaving && setOpenAssoc(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold">Associar transportadora</h4>
              <button
                className="rounded-md border px-2 py-1 text-sm"
                onClick={() => !assocSaving && setOpenAssoc(false)}
              >
                Fechar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600">Buscar</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="nome, razão social ou CNPJ…"
                  value={filtroTransp}
                  onChange={(e) => setFiltroTransp(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-slate-600">Transportadora</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={selTransp}
                  onChange={(e) => setSelTransp(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Selecione…</option>
                  {opcoesTranspFiltradas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {nomeTransp(t)}
                    </option>
                  ))}
                </select>
                {opcoesTranspFiltradas.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">Nenhuma transportadora ativa encontrada.</p>
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
                      await api.post(`/clientes/${cli!.id}/transportadoras`, {
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
