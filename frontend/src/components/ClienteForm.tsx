// src/components/ClienteForm.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

type ClientePayload = {
  nome_fantasia: string;
  tabela_preco: "ATACADAO" | "ESPECIAL"; // obrigatório pelo backend
  grupo_empresa?: string | null;
  whatsapp?: string | null;
  anotacoes?: string | null;
  status?: "ATIVO" | "INATIVO";
  recebe_whatsapp?: boolean;
};

const TABELAS = ["ATACADAO", "ESPECIAL"] as const;

// util: só dígitos
const onlyDigits = (s: string) => s.replace(/\D/g, "");

export default function ClienteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState<ClientePayload>({
    nome_fantasia: "",
    tabela_preco: "ATACADAO",
    status: "ATIVO",
    recebe_whatsapp: false,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const titulo = useMemo(
    () => (editing ? `Editar cliente #${id}` : "Novo cliente"),
    [editing, id]
  );

  async function load() {
    if (!editing) return;
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get(`/clientes/${id}`);
      setForm({
        nome_fantasia: data.nome_fantasia ?? "",
        tabela_preco: (data.tabela_preco as "ATACADAO" | "ESPECIAL") ?? "ATACADAO",
        grupo_empresa: data.grupo_empresa ?? null,
        whatsapp: data.whatsapp ?? null,
        anotacoes: data.anotacoes ?? null,
        status: data.status ?? "ATIVO",
        recebe_whatsapp: Boolean(data.recebe_whatsapp),
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

      // normaliza whatsapp para somente dígitos (ou null se vazio)
      const payload: ClientePayload = {
        ...form,
        nome_fantasia: nome,
        tabela_preco: form.tabela_preco, // obrigatório
        whatsapp: form.whatsapp && onlyDigits(form.whatsapp) ? onlyDigits(form.whatsapp) : null,
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
              const confirma = confirm(
                "Já existe um cliente com este nome.\nDeseja criar mesmo assim?"
              );
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
              if (exId) {
                nav(`/clientes/${exId}`);
                return;
              }
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

  return (
    <div className="mx-auto max-w-6xl">
      {/* Cabeçalho */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-3 py-2 rounded-md border hover:bg-slate-50"
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

      {/* Card do formulário */}
      <form
        onSubmit={onSubmit}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit(e as any);
        }}
        className="rounded-2xl border bg-white shadow-sm"
      >
        {/* Mensagens */}
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

        {/* Grid principal */}
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-12">
          {/* Coluna esquerda (8/12) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Identificação */}
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Identificação</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">
                    Nome fantasia <span className="text-red-600">*</span>
                  </label>
                  <input
                    className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                    value={form.nome_fantasia}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, nome_fantasia: e.target.value }))
                    }
                    autoFocus
                    placeholder="ex.: Mercado Central"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Grupo empresa</label>
                  <input
                    className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.grupo_empresa ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        grupo_empresa: e.target.value || null,
                      }))
                    }
                    placeholder="ex.: Grupo XPTO"
                  />
                </div>
              </div>
            </section>

            {/* Contato */}
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Contato</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-600">WhatsApp</label>
                  <input
                    className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.whatsapp ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        whatsapp: e.target.value || null,
                      }))
                    }
                    inputMode="tel"
                    placeholder="(00) 90000-0000"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Dica: pode digitar com pontos/traços; nós limpamos na hora de salvar.
                  </p>
                </div>
              </div>
            </section>

            {/* Anotações */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-800">Anotações</h2>
              <textarea
                className="mt-1 border rounded-md px-3 py-2 w-full min-h-[140px] focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.anotacoes ?? ""}
                onChange={(e) =>
                  setForm((s) => ({ ...s, anotacoes: e.target.value || null }))
                }
                placeholder="Observações gerais, preferências, restrições…"
              />
            </section>
          </div>

          {/* Coluna direita (4/12) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Comercial */}
            <section className="space-y-4 rounded-xl border p-4">
              <h2 className="text-base font-semibold text-slate-800">Comercial</h2>
              <div className="grid gap-4">
                <div>
                  <label className="text-sm text-slate-600">
                    Tabela de preço <span className="text-red-600">*</span>
                  </label>
                  <select
                    className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.tabela_preco}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        tabela_preco: e.target.value as "ATACADAO" | "ESPECIAL",
                      }))
                    }
                    required
                  >
                    {TABELAS.map((t) => (
                      <option key={t} value={t}>
                        {t === "ATACADAO" ? "ATACADÃO" : t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-600">Status</label>
                  <select
                    className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.status ?? "ATIVO"}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        status: (e.target.value as "ATIVO" | "INATIVO") ?? "ATIVO",
                      }))
                    }
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
                    onChange={(e) =>
                      setForm((s) => ({ ...s, recebe_whatsapp: e.target.checked }))
                    }
                  />
                  <span className="text-sm text-slate-700">
                    Recebe avisos por WhatsApp
                  </span>
                </label>
              </div>
            </section>

            {/* Ações */}
            <section className="rounded-xl border p-4">
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  title="Ctrl+Enter para salvar"
                >
                  {loading ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => nav(-1)}
                  className="px-4 py-2 bg-slate-100 rounded-md hover:bg-slate-200"
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
