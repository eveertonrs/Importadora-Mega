import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const nav = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/register", { nome, email, senha, permissao: "vendedor" });
      alert("Usuário criado. Faça login.");
      nav("/login");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded p-6 bg-white">
        <h1 className="text-xl font-semibold">Criar conta</h1>
        <input className="border rounded px-3 py-2 w-full" placeholder="Nome" value={nome} onChange={(e)=>setNome(e.target.value)} />
        <input className="border rounded px-3 py-2 w-full" placeholder="E-mail" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input type="password" className="border rounded px-3 py-2 w-full" placeholder="Senha" value={senha} onChange={(e)=>setSenha(e.target.value)} />
        <button disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {loading ? "Enviando…" : "Registrar"}
        </button>
      </form>
    </div>
  );
}
