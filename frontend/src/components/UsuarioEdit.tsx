import { useEffect, useState } from "react";
import api, { notify } from "../services/api";
import { useParams, useNavigate } from "react-router-dom";

type Permissao = "admin" | "financeiro" | "vendedor" | "administrativo";
type Usuario = { id: number; nome: string; email: string; permissao: Permissao; ativo: boolean };

export default function UsuarioEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = Number(id);

  const [form, setForm] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- Senha (opcional)
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/usuarios/${userId}`);
        setForm({ ...data, ativo: !!data.ativo });
      } catch (e: any) {
        notify("error", e?.response?.data?.message || "Usuário não encontrado");
        navigate("/usuarios");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    // valida apenas se tentar trocar a senha
    if (senha || senha2) {
      if (senha.length < 6) {
        notify("error", "A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (senha !== senha2) {
        notify("error", "A confirmação de senha não confere.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome,
        email: form.email.toLowerCase(),
        permissao: form.permissao,
        ativo: !!form.ativo,
      };
      if (senha) payload.senha = senha; // ← só manda se não estiver em branco

      await api.put(`/usuarios/${userId}`, payload);
      notify("success", "Usuário atualizado.");
      navigate("/usuarios");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Falha ao atualizar usuário";
      notify("error", msg);
    } finally {
      setSaving(false);
    }
  }

  // opcional: gerar senha temporária (admin)
  async function gerarSenhaTemporaria() {
    setResetting(true);
    try {
      const { data } = await api.post(`/usuarios/${userId}/reset-password`, {});
      const tmp = data?.senha_temporaria as string | undefined;
      if (tmp) {
        try { await navigator.clipboard.writeText(tmp); } catch {}
        setSenha(tmp);
        setSenha2(tmp);
        notify("success", "Senha temporária gerada (copiada).");
      } else {
        notify("success", "Senha redefinida com sucesso.");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Falha ao gerar senha temporária";
      notify("error", msg);
    } finally {
      setResetting(false);
    }
  }

  if (loading || !form) return <div className="p-6">Carregando…</div>;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Cabeçalho + Voltar */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Editar usuário</h1>
          <p className="text-sm text-slate-600">Altere os dados e salve para aplicar as mudanças.</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Voltar
        </button>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-bold">
              USR
            </span>
            <div>
              <div className="text-sm font-medium">#{form.id} — {form.nome}</div>
              <div className="text-xs text-slate-500">Atualize as informações do usuário.</div>
            </div>
          </div>
        </div>

        <form className="px-6 py-5 space-y-6" onSubmit={submit}>
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-800">Nome</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </div>

          {/* Email + Permissão */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800">E-mail</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800">Permissão</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.permissao}
                onChange={(e) => setForm({ ...form, permissao: e.target.value as Permissao })}
              >
                <option value="administrativo">administrativo — acesso a blocos, clientes e transportadoras</option>
                <option value="admin">admin — acesso total</option>
                {/* futuras:
                <option value="vendedor">vendedor</option>
                <option value="financeiro">financeiro</option> */}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800">Status</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                value={form.ativo ? "1" : "0"}
                onChange={(e) => setForm({ ...form, ativo: e.target.value === "1" })}
              >
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </select>
            </div>
          </div>

          {/* 🔐 Senha (opcional) — mantém todo o resto da tela */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-800">
                  Nova senha <span className="text-slate-400">(opcional)</span>
                </label>
                <div className="mt-1 relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="Deixe em branco para manter"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    {showPwd ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">Mínimo de 6 caracteres.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800">Confirmar nova senha</label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  value={senha2}
                  onChange={(e) => setSenha2(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={gerarSenhaTemporaria}
                disabled={resetting}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                {resetting ? "Gerando…" : "Gerar senha temporária"}
              </button>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Voltar
            </button>
            <button
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                </svg>
              )}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
