import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { notify } from "../services/api";

type Permissao = "admin" | "financeiro" | "vendedor" | "administrativo";

type Usuario = {
  id: number;
  nome: string;
  email: string;
  permissao: Permissao;
  ativo: boolean;
  criado_em: string;
};

type RespLista = {
  data: Usuario[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

const permissoes: { value: "all" | Permissao; label: string }[] = [
  { value: "all", label: "(todas)" },
  { value: "admin", label: "Admin" },
  { value: "financeiro", label: "Financeiro" },
  { value: "vendedor", label: "Vendedor" },
  { value: "administrativo", label: "Administrativo" },
];

export default function UsuariosList() {
  const [rows, setRows] = useState<Usuario[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [ativo, setAtivo] = useState<"all" | "1" | "0">("all");
  const [permissao, setPermissao] = useState<"all" | Permissao>("all");
  const [loading, setLoading] = useState(false);

  const params = useMemo(
    () => ({ page, limit, search, ativo, permissao }),
    [page, limit, search, ativo, permissao]
  );

  async function load() {
    setLoading(true);
    try {
      // ✅ sem "/api" aqui — o BASE já tem /api
      const { data } = await api.get<RespLista>("/usuarios", { params });
      setRows(data.data);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Erro ao carregar usuários";
      notify("error", msg);
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]); // paginação

  // filtrar (reinicia na página 1)
  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuários</h1>
        <Link
          to="/usuarios/novo"
          className="inline-flex items-center rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm hover:bg-indigo-700"
        >
          + Novo usuário
        </Link>
      </div>

      <form onSubmit={applyFilters} className="rounded-xl border p-3 flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[260px]">
          <input
            placeholder="nome ou e-mail"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          value={ativo}
          onChange={(e) => setAtivo(e.target.value as any)}
        >
          <option value="all">(todos)</option>
          <option value="1">Ativos</option>
          <option value="0">Inativos</option>
        </select>

        <select
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          value={permissao}
          onChange={(e) => setPermissao(e.target.value as any)}
        >
          {permissoes.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-md bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">E-mail</th>
              <th className="px-3 py-2 text-left">Permissão</th>
              <th className="px-3 py-2 text-left">Ativo</th>
              <th className="px-3 py-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}

            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.nome}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2 capitalize">{u.permissao}</td>
                <td className="px-3 py-2">
                  {u.ativo ? (
                    <span className="inline-block rounded bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[12px]">
                      ativo
                    </span>
                  ) : (
                    <span className="inline-block rounded bg-rose-100 text-rose-700 px-2 py-0.5 text-[12px]">
                      inativo
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/usuarios/${u.id}/editar`}
                    className="text-indigo-600 hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* paginação simples */}
      <div className="flex items-center gap-2">
        <button
          className="rounded border px-2 py-1 text-sm disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          ◀
        </button>
        <div className="text-sm">
          Página {page} / {totalPages} • {total} registro(s)
        </div>
        <button
          className="rounded border px-2 py-1 text-sm disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          ▶
        </button>

        <select
          className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-sm"
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/pág
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
