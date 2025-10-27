import React, { useMemo, useState } from "react";
import api, { notify } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { Permissao } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

/** Utils simples */
const emailOK = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const senhaScore = (s: string) => {
  let score = 0;
  if (s.length >= 6) score++;
  if (/[A-Z]/.test(s)) score++;
  if (/[a-z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  return Math.min(score, 4); // 0..4
};
const strengthLabel = ["Muito fraca", "Fraca", "Média", "Boa", "Excelente"] as const;

const Register: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [permissao, setPermissao] = useState<Permissao>("administrativo");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ nome?: string; email?: string; senha?: string }>({});

  const score = useMemo(() => senhaScore(senha), [senha]);

  if (user?.permissao !== "admin") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-2">Acesso restrito</h2>
          <p className="text-sm text-slate-600">
            Apenas <span className="font-medium">administradores</span> podem cadastrar usuários.
          </p>
        </div>
      </div>
    );
  }

  const validate = () => {
    const e: typeof errors = {};
    if (nome.trim().length < 2) e.nome = "Informe o nome completo.";
    if (!emailOK(email)) e.email = "E-mail inválido.";
    if (senha.length < 6) e.senha = "A senha deve ter pelo menos 6 caracteres.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post("/auth/register", { nome, email, senha, permissao });
      notify("success", "Usuário cadastrado com sucesso.");
      setNome("");
      setEmail("");
      setSenha("");
      setPermissao("administrativo");
      setErrors({});
      navigate("/usuarios");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Falha ao criar usuário";
      notify("error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Cabeçalho da página */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cadastrar usuário</h1>
          <p className="text-sm text-slate-600">
            Crie contas de acesso para a equipe. Por padrão sugerimos o perfil{" "}
            <span className="font-medium">administrativo</span>.
          </p>
        </div>

        {/* Botão Voltar */}
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
              <div className="text-sm font-medium">Novo usuário</div>
              <div className="text-xs text-slate-500">Preencha os dados abaixo e clique em salvar.</div>
            </div>
          </div>
        </div>

        <form className="px-6 py-5 space-y-5" onSubmit={submit} noValidate>
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-800">Nome</label>
            <input
              className={[
                "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                errors.nome ? "border-red-300 focus:ring-2 focus:ring-red-300" : "border-slate-300 focus:ring-2 focus:ring-slate-300",
              ].join(" ")}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Maria da Silva"
            />
            {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome}</p>}
          </div>

          {/* Email + Permissão */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800">E-mail</label>
              <input
                className={[
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  errors.email ? "border-red-300 focus:ring-2 focus:ring-red-300" : "border-slate-300 focus:ring-2 focus:ring-slate-300",
                ].join(" ")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800">Permissão</label>
              <div className="mt-1 relative">
                <select
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  value={permissao}
                  onChange={(e) => setPermissao(e.target.value as Permissao)}
                >
                  <option value="administrativo">administrativo — acesso a blocos, clientes e transportadoras</option>
                  <option value="admin">admin — acesso total</option>
                </select>
              </div>
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-slate-800">Senha</label>
            <div className="mt-1 relative">
              <input
                className={[
                  "w-full rounded-xl border px-3 py-2 pr-10 text-sm outline-none",
                  errors.senha ? "border-red-300 focus:ring-2 focus:ring-red-300" : "border-slate-300 focus:ring-2 focus:ring-slate-300",
                ].join(" ")}
                type={showPass ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                title={showPass ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPass ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.9 4.24A10.94 10.94 0 0112 4c5.05 0 9.27 3.11 10.5 7.5-.32 1.16-.9 2.23-1.68 3.17M6.53 6.53C4.5 7.76 3.06 9.5 2 11.5c1.05 2.15 2.82 3.93 5.03 5.06A10.94 10.94 0 0012 20c1.2 0 2.35-.18 3.42-.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* barra de força */}
            <div className="mt-2">
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={[
                    "h-2 rounded-full transition-all",
                    score === 0 ? "w-0" :
                    score === 1 ? "w-1/5 bg-red-500" :
                    score === 2 ? "w-2/5 bg-orange-500" :
                    score === 3 ? "w-3/5 bg-yellow-500" :
                    "w-4/5 bg-emerald-600"
                  ].join(" ")}
                />
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                Força da senha: <span className="font-medium">{strengthLabel[score]}</span>
              </div>
            </div>
            {errors.senha && <p className="mt-1 text-xs text-red-600">{errors.senha}</p>}
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                setNome("");
                setEmail("");
                setSenha("");
                setPermissao("administrativo");
                setErrors({});
              }}
              disabled={loading}
            >
              Limpar
            </button>
            <button
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                </svg>
              )}
              Salvar
            </button>
          </div>
        </form>

        {/* Rodapé com nota de papéis */}
        <div className="px-6 py-4 border-t bg-slate-50/60 text-xs text-slate-600">
          <span className="font-medium">Perfis:</span>{" "}
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 mr-1">administrativo</span>
          acesso a <span className="font-medium">Blocos</span>, <span className="font-medium">Clientes</span> e{" "}
          <span className="font-medium">Transportadoras</span>; sem Financeiro/Conferência/Histórico/Parâmetros.
        </div>
      </div>
    </div>
  );
};

export default Register;
