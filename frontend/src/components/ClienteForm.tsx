import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

/* ===================== Tipos ===================== */
type ClientePayload = {
  nome_fantasia: string;
  tabela_preco: string;
  grupo_empresa?: string | null;
  whatsapp?: string | null;
  anotacoes?: string | null;
  status?: "ATIVO" | "INATIVO";
  recebe_whatsapp?: boolean;
  transportadora_id?: number | null;
};

type Transportadora = {
  id: number;
  nome?: string;
  nome_fantasia?: string;
  razao_social?: string;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/* ===================== Componente ===================== */
export default function ClienteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState<ClientePayload>({
    nome_fantasia: "",
    tabela_preco: "",
    status: "ATIVO",
    recebe_whatsapp: false,
    transportadora_id: null,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [tabelas, setTabelas] = useState<string[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);

  const titulo = useMemo(
    () => (editing ? `Editar cliente #${id}` : "Novo cliente"),
    [editing, id]
  );

  /* ===================== Combos dinâmicos ===================== */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // tabelas de preço
        try {
          const { data } = await api.get("/tabelas-preco", { headers: { "x-silent": "1" } });
          if (!cancel) setTabelas((data?.data ?? data ?? []) as string[]);
        } catch {
          const { data } = await api.get("/clientes/tabelas-preco", { headers: { "x-silent": "1" } });
          if (!cancel) setTabelas((data?.data ?? data ?? []) as string[]);
        }
        // transportadoras (ativas)
        try {
          const { data } = await api.get("/transportadoras", {
            params: { status: "ATIVO", limit: 999 },
            headers: { "x-silent": "1" },
          });
          if (!cancel) setTransportadoras(data?.data ?? data ?? []);
        } catch {/* ignore */}
      } catch {/* ignore */}
    })();
    return () => { cancel = true; };
  }, []);

  /* ===================== Carregar para edição ===================== */
  async function load() {
    if (!editing) return;
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(`/clientes/${id}`);
      setForm({
        nome_fantasia: data.nome_fantasia ?? "",
        tabela_preco: data.tabela_preco ?? "",
        grupo_empresa: data.grupo_empresa ?? null,
        whatsapp: data.whatsapp ?? null,
        anotacoes: data.anotacoes ?? null,
        status: data.status ?? "ATIVO",
        recebe_whatsapp: Boolean(data.recebe_whatsapp),
        transportadora_id: data.transportadora_id ?? null,
      });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Falha ao carregar o cliente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ===================== Salvar ===================== */
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      const nome = form.nome_fantasia?.trim();
      if (!nome) {
        setErr("Informe o nome fantasia.");
        return;
      }

      setLoading(true);
      setErr(null);
      setOk(false);

      const payload: ClientePayload = {
        ...form,
        nome_fantasia: nome,
        tabela_preco: form.tabela_preco?.trim() || "",
        whatsapp: form.whatsapp && onlyDigits(form.whatsapp) ? onlyDigits(form.whatsapp) : null,
        transportadora_id: form.transportadora_id || null,
      };

      try {
        if (editing) {
          await api.put(`/clientes/${id}`, payload);
          setOk(true);
          setTimeout(() => nav(-1), 400);
        } else {
          try {
            const r = await api.post("/clientes", payload);
            const newId = r.data?.id ?? r.data?.data?.id;
            setOk(true);
            setTimeout(() => {
              if (newId) nav(`/clientes/${newId}`);
              else nav(-1);
            }, 400);
          } catch (err: any) {
            // conflito por nome duplicado
            if (err?.response?.status === 409) {
              const exId = err.response.data?.existing_id;
              const confirma = confirm("Já existe um cliente com este nome.\nDeseja criar mesmo assim?");
              if (confirma) {
                const r2 = await api.post("/clientes?allowDuplicate=1", payload);
                const newId = r2.data?.id ?? r2.data?.data?.id;
                setOk(true);
                setTimeout(() => {
                  if (newId) nav(`/clientes/${newId}`); else nav(-1);
                }, 400);
                return;
              }
              if (exId) { nav(`/clientes/${exId}`); return; }
              setErr(err.response.data?.message || "Nome já existente.");
              return;
            }
            throw err;
          }
        }
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Falha ao salvar o cliente.");
      } finally {
        setLoading(false);
      }
    },
    [editing, form, id, nav, loading]
  );

  const nomeTransportadora = (t?: Transportadora | null) =>
    (t?.nome_fantasia || t?.razao_social || t?.nome || "").trim();

  /* ===================== UI ===================== */
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HERO */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white p-6 shadow">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{titulo}</h1>
            <p className="text-slate-300">
              Preencha os dados do cliente. Campos com <span className="text-rose-300">*</span> são obrigatórios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="rounded-xl bg-white/10 px-4 py-2 text-white ring-1 ring-white/30 hover:bg-white/20"
          >
            ← Voltar
          </button>
        </div>
      </section>

      {/* FORM */}
      <form
        onSubmit={onSubmit}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit(e as any);
        }}
        className="rounded-2xl border bg-white shadow-sm"
      >
        {(err || ok) && (
          <div className="p-4 border-b">
            {err && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                {err}
              </div>
            )}
            {ok && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                Cliente salvo com sucesso!
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-12">
          {/* COL ESQUERDA */}
          <div className="lg:col-span-8 space-y-6">
            {/* Identificação */}
            <section className="rounded-xl border p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Identificação</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">
                    Nome fantasia <span className="text-rose-600">*</span>
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                    required
                    value={form.nome_fantasia}
                    onChange={(e) => setForm((s) => ({ ...s, nome_fantasia: e.target.value }))}
                    autoFocus
                    placeholder="ex.: Depósito JL"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Grupo empresa</label>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.grupo_empresa ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, grupo_empresa: e.target.value || null }))}
                    placeholder="ex.: Grupo XPTO"
                  />
                </div>
              </div>
            </section>

            {/* Contato */}
            <section className="rounded-xl border p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Contato</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">WhatsApp</label>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.whatsapp ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value || null }))}
                    inputMode="tel"
                    placeholder="(00) 90000-0000"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Pode digitar com pontos/traços; a limpeza é feita ao salvar.
                  </p>
                </div>
              </div>
            </section>

            {/* Anotações */}
            <section className="rounded-xl border p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Anotações</h2>
              <textarea
                className="mt-1 min-h-[140px] w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                value={form.anotacoes ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, anotacoes: e.target.value || null }))}
                placeholder="Observações gerais, preferências, restrições…"
              />
            </section>
          </div>

          {/* COL DIREITA */}
          <div className="lg:col-span-4 space-y-6">
            {/* Comercial */}
            <section className="rounded-xl border p-4">
              <h2 className="mb-3 text-base font-semibold text-slate-800">Comercial</h2>
              <div className="grid gap-4">
                {/* Tabela de preço (dinâmica; fallback input) */}
                <div>
                  <label className="text-sm text-slate-600">
                    Tabela de preço <span className="text-rose-600">*</span>
                  </label>
                  {tabelas.length > 0 ? (
                    <select
                      className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.tabela_preco}
                      onChange={(e) => setForm((s) => ({ ...s, tabela_preco: e.target.value }))}
                      required
                    >
                      <option value="" disabled>
                        (selecione)
                      </option>
                      {tabelas.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.tabela_preco}
                      onChange={(e) => setForm((s) => ({ ...s, tabela_preco: e.target.value }))}
                      placeholder="ex.: ESPECIAL"
                      required
                    />
                  )}
                </div>

                {/* Transportadora associada */}
                <div>
                  <label className="text-sm text-slate-600">Transportadora (associada ao cliente)</label>
                  {transportadoras.length > 0 ? (
                    <select
                      className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.transportadora_id ?? ""}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          transportadora_id: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                    >
                      <option value="">(nenhuma)</option>
                      {transportadoras.map((t) => (
                        <option key={t.id} value={t.id}>
                          {nomeTransportadora(t)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 text-xs text-slate-500">Nenhuma transportadora disponível.</div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="text-sm text-slate-600">Status</label>
                  <select
                    className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.status ?? "ATIVO"}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, status: (e.target.value as "ATIVO" | "INATIVO") ?? "ATIVO" }))
                    }
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </div>

                {/* Notificação por WhatsApp */}
                <label className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <input
                    id="recebe_wpp"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={!!form.recebe_whatsapp}
                    onChange={(e) => setForm((s) => ({ ...s, recebe_whatsapp: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-700">Recebe avisos por WhatsApp</span>
                </label>
              </div>
            </section>

            {/* Ações */}
            <section className="rounded-xl border p-4">
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  title="Ctrl+Enter para salvar"
                >
                  {loading ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => nav(-1)}
                  className="rounded-xl bg-slate-100 px-4 py-2 hover:bg-slate-200"
                >
                  Cancelar
                </button>
              </div>
              {!editing && (
                <p className="mt-3 text-xs text-slate-500">
                  Dica: após salvar, você poderá incluir documentos e links do cliente.
                </p>
              )}
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}
