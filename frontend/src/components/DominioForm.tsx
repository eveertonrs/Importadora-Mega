// src/components/DominioForm.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

export default function DominioForm() {
  const nav = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [chave, setChave] = useState("");
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const slugify = (input: string) =>
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data } = await api.get(`/dominios/${id}`);
        setChave(data.chave ?? "");
        setNome(data.nome ?? "");
        setAtivo(Boolean(data.ativo));
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Falha ao carregar domínio.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);

    const body = {
      chave: (chave || slugify(nome)).trim(),
      nome: nome.trim(),
      ativo,
    };

    if (!body.nome || !body.chave) {
      setErr("Informe o nome e a chave do domínio.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/dominios/${id}`, body);
      } else {
        await api.post("/dominios", body);
      }
      setOk(true);
      setTimeout(() => nav("/dominios"), 400);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        (error?.response?.status === 409
          ? "Já existe um domínio com essa chave."
          : editing
          ? "Erro ao atualizar domínio."
          : "Erro ao cadastrar domínio.");
      setErr(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cabeçalho */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-3 py-2 rounded border hover:bg-slate-50"
          >
            ← Voltar
          </button>
          <div>
            <h1 className="text-xl font-semibold">
              {editing ? `Editar domínio #${id}` : "Novo domínio"}
            </h1>
            <p className="text-sm text-slate-500">
              {editing
                ? "Atualize os dados do domínio."
                : "Cadastre chaves para listas de valores (formas de pagamento, tipos, etc.)."}
            </p>
          </div>
        </div>
      </div>

      {/* Card */}
      <form
        onSubmit={onSubmit}
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
                Domínio salvo com sucesso!
              </div>
            )}
          </div>
        )}

        {/* Conteúdo */}
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-12">
          {/* Coluna esquerda */}
          <section className="lg:col-span-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm text-slate-700">
                  Nome <span className="text-red-600">*</span>
                </label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Condições de Pagamento"
                  autoFocus
                />
                <p className="mt-1 text-xs text-slate-500">
                  Dica: usamos o nome para sugerir a chave, se ela estiver vazia.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-slate-700">
                  Chave <span className="text-red-600">*</span>
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    className="flex-1 rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={chave}
                    onChange={(e) => setChave(e.target.value)}
                    placeholder="Ex.: CONDICOES_DE_PAGAMENTO"
                  />
                  {!editing && (
                    <button
                      type="button"
                      className="rounded border px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => setChave(slugify(nome).toUpperCase())}
                      title="Gerar a partir do nome"
                    >
                      Gerar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Coluna direita */}
          <section className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                Status
              </h3>
              <label className="flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
                <span className="text-sm text-slate-700">Ativo</span>
              </label>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Pré-visualização
              </h3>
              <div className="text-xs text-slate-500">Chave sugerida</div>
              <div className="mt-1 font-mono text-sm">
                {(chave || slugify(nome)).toUpperCase() || "—"}
              </div>
            </div>
          </section>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 border-t p-4">
          <button
            type="submit"
            disabled={saving || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => nav("/dominios")}
            className="px-4 py-2 bg-slate-100 rounded-md hover:bg-slate-200"
          >
            Cancelar
          </button>
          {loading && (
            <span className="ml-2 text-sm text-slate-500">Carregando…</span>
          )}
        </div>
      </form>
    </div>
  );
}
