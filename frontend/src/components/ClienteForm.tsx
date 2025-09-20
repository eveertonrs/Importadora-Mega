// src/components/ClienteForm.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

type ClientePayload = {
  nome_fantasia: string;
  tabela_preco?: string | null;
  grupo_empresa?: string | null;
  whatsapp?: string | null;
  anotacoes?: string | null;
  status?: "ATIVO" | "INATIVO";
  recebe_whatsapp?: boolean;
};

const TABELAS = ["ATACADAO", "ESPECIAL"] as const;

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
        tabela_preco: data.tabela_preco ?? null,
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
      if (!form.nome_fantasia?.trim()) {
        setErr("Informe o nome fantasia.");
        return;
      }

      setLoading(true);
      setErr(null);
      setOk(false);
      try {
        if (editing) {
          await api.put(`/clientes/${id}`, form);
          setOk(true);
          setTimeout(() => nav(-1), 400);
        } else {
          const r = await api.post("/clientes", form);
          const newId = r.data?.id ?? r.data?.data?.id;
          setOk(true);
          setTimeout(() => {
            if (newId) nav(`/clientes/${newId}`);
            else nav(-1);
          }, 400);
        }
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Falha ao salvar o cliente.");
      } finally {
        setLoading(false);
      }
    },
    [editing, form, id, nav]
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="px-3 py-2 rounded-md border hover:bg-slate-50"
        >
          ← Voltar
        </button>
        <h1 className="text-xl font-semibold">{titulo}</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-xl border bg-white p-5 shadow-sm space-y-5"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit(e as any);
        }}
      >
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

        {/* Identificação */}
        <section className="space-y-3">
          <h2 className="font-medium text-slate-800">Identificação</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600">Nome fantasia *</label>
              <input
                className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
                value={form.nome_fantasia}
                onChange={(e) =>
                  setForm((s) => ({ ...s, nome_fantasia: e.target.value }))
                }
                autoFocus
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

        {/* Comercial */}
        <section className="space-y-3">
          <h2 className="font-medium text-slate-800">Comercial</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-600">Tabela de preço</label>
              <select
                className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.tabela_preco ?? ""}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    tabela_preco: e.target.value || null,
                  }))
                }
              >
                <option value="">(nenhuma)</option>
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

            <div className="flex items-end gap-2">
              <input
                id="recebe_wpp"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={!!form.recebe_whatsapp}
                onChange={(e) =>
                  setForm((s) => ({ ...s, recebe_whatsapp: e.target.checked }))
                }
              />
              <label htmlFor="recebe_wpp" className="text-sm text-slate-700">
                Recebe avisos por WhatsApp
              </label>
            </div>
          </div>
        </section>

        {/* Contato */}
        <section className="space-y-3">
          <h2 className="font-medium text-slate-800">Contato</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600">WhatsApp</label>
              <input
                className="mt-1 border rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.whatsapp ?? ""}
                onChange={(e) =>
                  setForm((s) => ({ ...s, whatsapp: e.target.value || null }))
                }
                placeholder="(00) 90000-0000"
              />
            </div>
          </div>
        </section>

        {/* Anotações */}
        <section className="space-y-3">
          <h2 className="font-medium text-slate-800">Anotações</h2>
          <textarea
            className="mt-1 border rounded-md px-3 py-2 w-full min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={form.anotacoes ?? ""}
            onChange={(e) =>
              setForm((s) => ({ ...s, anotacoes: e.target.value || null }))
            }
            placeholder="Observações gerais, preferências, restrições…"
          />
        </section>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
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
      </form>
    </div>
  );
}
