import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

type ClientePayload = {
  nome_fantasia: string;
  tabela_preco: string; // dinâmico
  grupo_empresa?: string | null;
  whatsapp?: string | null;
  anotacoes?: string | null;
  status?: "ATIVO" | "INATIVO";
  recebe_whatsapp?: boolean;
  transportadora_id?: number | null;
};

type Transportadora = { id: number; nome?: string; nome_fantasia?: string; razao_social?: string };
const onlyDigits = (s: string) => s.replace(/\D/g, "");

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

  // combos dinâmicos
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        try {
          const { data } = await api.get("/tabelas-preco", { headers: { "x-silent": "1" } });
          if (!cancel) setTabelas((data?.data ?? data ?? []) as string[]);
        } catch {
          const { data } = await api.get("/clientes/tabelas-preco", { headers: { "x-silent": "1" } });
          if (!cancel) setTabelas((data?.data ?? data ?? []) as string[]);
        }
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
            if (err?.response?.status === 409) {
              const exId = err.response.data?.existing_id;
              const confirma = confirm("Já existe um cliente com este nome.\nDeseja criar mesmo assim?");
              if (confirma) {
                const r2 = await api.post("/clientes?allowDuplicate=1", payload);
                const newId = r2.data?.id ?? r2.data?.data?.id;
                setOk(true);
                setTimeout(() => {
                  if (newId) nav(`/clientes/${newId}`);
                  else nav(-1);
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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-3 py-2 rounded-xl border hover:bg-slate-50"
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-xl font-semibold">{titulo}</h1>
            <p className="text-sm text-slate-500">
              Preencha os dados do cliente. Campos com <span className="text-red-600">*</span> são obrigatórios.
            </p>
          </div>
        </div>
      </div>

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
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                {err}
              </div>
            )}
            {ok && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
                Cliente salvo com sucesso!
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Identificação</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">
                    Nome fantasia <span className="text-red-600">*</span>
                  </label>
                  <input
                    className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                    className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.grupo_empresa ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, grupo_empresa: e.target.value || null }))}
                    placeholder="ex.: Grupo XPTO"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Contato</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">WhatsApp</label>
                  <input
                    className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
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

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-800">Anotações</h2>
              <textarea
                className="mt-1 border rounded-xl px-3 py-2 w-full min-h-[140px] focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.anotacoes ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, anotacoes: e.target.value || null }))}
                placeholder="Observações gerais, preferências, restrições…"
              />
            </section>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <section className="space-y-4 rounded-xl border p-4">
              <h2 className="text-base font-semibold text-slate-800">Comercial</h2>
              <div className="grid gap-4">
                {/* Tabela de preço (dinâmica, com fallback para input livre) */}
                <div>
                  <label className="text-sm text-slate-600">
                    Tabela de preço <span className="text-red-600">*</span>
                  </label>
                  {tabelas.length > 0 ? (
                    <select
                      className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                      value={form.tabela_preco}
                      onChange={(e) => setForm((s) => ({ ...s, tabela_preco: e.target.value }))}
                      required
                    >
                      <option value="" disabled>(selecione)</option>
                      {tabelas.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                      className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                        <option key={t.id} value={t.id}>{nomeTransportadora(t)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-slate-500 mt-1">Nenhuma transportadora disponível.</div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-slate-600">Status</label>
                  <select
                    className="mt-1 border rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.status ?? "ATIVO"}
                    onChange={(e) => setForm((s) => ({ ...s, status: (e.target.value as "ATIVO" | "INATIVO") ?? "ATIVO" }))}
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </div>

                <label className="flex items-center gap-2">
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

            <section className="rounded-xl border p-4">
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  title="Ctrl+Enter para salvar"
                >
                  {loading ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => nav(-1)}
                  className="px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200"
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
