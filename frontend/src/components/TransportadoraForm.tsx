import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

/** Tipos */
type Transp = {
  id: number;
  razao_social: string;
  cnpj?: string | null;
  forma_envio?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  referencia?: string | null;
  ativo: boolean;
};
type Page<T> = { data: T[]; total: number; page: number; limit: number };

/** Utils */
const toStr = (v?: string | null) => v ?? "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function TransportadoraForm() {
  // listagem
  const [rows, setRows] = useState<Transp[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  // criação
  const [nzRazao, setNzRazao] = useState("");
  const [nzCnpj, setNzCnpj] = useState("");
  const [nzForma, setNzForma] = useState("");
  const [nzTel, setNzTel] = useState("");
  const [nzEnd, setNzEnd] = useState("");
  const [nzRef, setNzRef] = useState("");

  // edição inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Transp | null>(null);
  const isEditing = (id: number) => editingId === id;

  async function load(opts?: { keepPage?: boolean }) {
    setLoading(true);
    try {
      const { data } = await api.get<Page<Transp>>("/transportadoras", {
        params: { page: opts?.keepPage ? page : 1, limit, search },
      });
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
      if (!opts?.keepPage) setPage(data.page ?? 1);
    } finally {
      setLoading(false);
    }
  }

  // debounce do filtro
  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [search, limit]);

  useEffect(() => { load({ keepPage: true }); }, [page]);

  /** Criar */
  async function create() {
    if (!nzRazao.trim()) return;
    setLoading(true);
    try {
      const payload: any = {
        razao_social: nzRazao.trim(),
        ativo: true,
        cnpj: nzCnpj || undefined,
        forma_envio: nzForma || undefined,
        telefone: nzTel || undefined,
        endereco: nzEnd || undefined,
        referencia: nzRef || undefined,
      };
      await api.post("/transportadoras", payload);
      setNzRazao(""); setNzCnpj(""); setNzForma(""); setNzTel(""); setNzEnd(""); setNzRef("");
      await load();
      alert("Transportadora criada com sucesso.");
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Não foi possível criar.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  /** Entrar em modo edição */
  function startEdit(t: Transp) {
    setEditingId(t.id);
    setEdit({ ...t });
  }
  function cancelEdit() {
    setEditingId(null);
    setEdit(null);
  }
  /** Salvar edição */
  async function saveEdit() {
    if (!edit) return;
    setLoading(true);
    try {
      const { id, ...body } = edit;
      await api.put(`/transportadoras/${id}`, body);
      await load({ keepPage: true });
      cancelEdit();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Falha ao atualizar.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  /** Ativar / Inativar (toggle otimista) */
  async function toggleActive(t: Transp) {
    const prev = [...rows];
    setRows((list) => list.map((x) => (x.id === t.id ? { ...x, ativo: !x.ativo } : x)));
    try {
      await api.put(`/transportadoras/${t.id}`, { ativo: !t.ativo });
    } catch (e) {
      setRows(prev);
      alert("Não foi possível atualizar o status.");
      console.error(e);
    }
  }

  /** Excluir */
  async function remove(t: Transp) {
    if (!confirm(`Excluir "${t.razao_social}"?`)) return;
    setLoading(true);
    try {
      await api.delete(`/transportadoras/${t.id}`);
      // se apagar o último item da página, volta 1 página
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      await load({ keepPage: true });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Falha ao excluir.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(1, limit))),
    [total, limit]
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Transportadoras</h1>

      {/* Filtro + paginação */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="border rounded px-3 py-2 min-w-[260px]"
          placeholder="Buscar (razão social, CNPJ, telefone)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-2 py-2"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/página</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="border rounded px-2 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >Anterior</button>
          <span className="text-sm text-slate-600">
            Página {page} de {totalPages} — {total} registro(s)
          </span>
          <button
            className="border rounded px-2 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >Próxima</button>
        </div>
      </div>

      {/* Criar */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Razão social*</label>
            <input className="mt-1 w-full rounded border px-3 py-2"
              value={nzRazao} onChange={(e) => setNzRazao(e.target.value)} placeholder="Ex.: Trans Metal LTDA" />
          </div>
          <div>
            <label className="text-sm font-medium">CNPJ</label>
            <input className="mt-1 w-full rounded border px-3 py-2"
              value={nzCnpj} onChange={(e) => setNzCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label className="text-sm font-medium">Forma de envio</label>
            <input className="mt-1 w-full rounded border px-3 py-2"
              value={nzForma} onChange={(e) => setNzForma(e.target.value)} placeholder="Rodoviário, Retira, Motoboy…" />
          </div>
          <div>
            <label className="text-sm font-medium">Telefone</label>
            <input className="mt-1 w-full rounded border px-3 py-2"
              value={nzTel} onChange={(e) => setNzTel(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className="text-sm font-medium">Referência (p/ motorista)</label>
            <input className="mt-1 w-full rounded border px-3 py-2"
              value={nzRef} onChange={(e) => setNzRef(e.target.value)} placeholder="Próximo ao galpão azul" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Endereço</label>
            <input className="mt-1 w-full rounded border px-3 py-2"
              value={nzEnd} onChange={(e) => setNzEnd(e.target.value)} placeholder="Rua/Av, nº, bairro, cidade/UF" />
          </div>
        </div>
        <div className="pt-2">
          <button
            onClick={create}
            disabled={loading || !nzRazao.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border w-16">#</th>
              <th className="p-2 border">Razão social</th>
              <th className="p-2 border">CNPJ</th>
              <th className="p-2 border">Forma envio</th>
              <th className="p-2 border">Telefone</th>
              <th className="p-2 border">Endereço</th>
              <th className="p-2 border">Referência</th>
              <th className="p-2 border w-20">Ativo</th>
              <th className="p-2 border w-52">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="p-4 text-center">Carregando…</td></tr>
            )}

            {!loading && rows.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="p-2 border text-center">{t.id}</td>

                {/* Razão social */}
                <td className="p-2 border">
                  {isEditing(t.id) ? (
                    <input className="w-full border rounded px-2 py-1"
                      value={toStr(edit?.razao_social)}
                      onChange={(e) => setEdit((s) => ({ ...(s as Transp), razao_social: e.target.value }))}
                    />
                  ) : t.razao_social}
                </td>

                {/* CNPJ */}
                <td className="p-2 border">
                  {isEditing(t.id) ? (
                    <input className="w-full border rounded px-2 py-1"
                      value={toStr(edit?.cnpj)}
                      onChange={(e) => setEdit((s) => ({ ...(s as Transp), cnpj: e.target.value }))}
                    />
                  ) : (t.cnpj ?? "-")}
                </td>

                {/* Forma envio */}
                <td className="p-2 border">
                  {isEditing(t.id) ? (
                    <input className="w-full border rounded px-2 py-1"
                      value={toStr(edit?.forma_envio)}
                      onChange={(e) => setEdit((s) => ({ ...(s as Transp), forma_envio: e.target.value }))}
                    />
                  ) : (t.forma_envio ?? "-")}
                </td>

                {/* Telefone */}
                <td className="p-2 border">
                  {isEditing(t.id) ? (
                    <input className="w-full border rounded px-2 py-1"
                      value={toStr(edit?.telefone)}
                      onChange={(e) => setEdit((s) => ({ ...(s as Transp), telefone: e.target.value }))}
                    />
                  ) : (t.telefone ?? "-")}
                </td>

                {/* Endereço */}
                <td className="p-2 border">
                  {isEditing(t.id) ? (
                    <input className="w-full border rounded px-2 py-1"
                      value={toStr(edit?.endereco)}
                      onChange={(e) => setEdit((s) => ({ ...(s as Transp), endereco: e.target.value }))}
                    />
                  ) : (t.endereco ?? "-")}
                </td>

                {/* Referência */}
                <td className="p-2 border">
                  {isEditing(t.id) ? (
                    <input className="w-full border rounded px-2 py-1"
                      value={toStr(edit?.referencia)}
                      onChange={(e) => setEdit((s) => ({ ...(s as Transp), referencia: e.target.value }))}
                    />
                  ) : (t.referencia ?? "-")}
                </td>

                {/* Ativo */}
                <td className="p-2 border text-center">
                  <button
                    className={["px-2 py-1 rounded border",
                      t.ativo ? "bg-white" : "bg-emerald-600 text-white"].join(" ")}
                    onClick={() => toggleActive(t)}
                    title={t.ativo ? "Desativar" : "Ativar"}
                  >
                    {t.ativo ? "Sim" : "Não"}
                  </button>
                </td>

                {/* Ações */}
                <td className="p-2 border">
                  {isEditing(t.id) ? (
                    <div className="flex gap-2">
                      <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={saveEdit}>Salvar</button>
                      <button className="px-3 py-1 rounded border" onClick={cancelEdit}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="px-3 py-1 rounded border" onClick={() => startEdit(t)}>Editar</button>
                      <button className="px-3 py-1 rounded border hover:bg-red-50" onClick={() => remove(t)}>Excluir</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-gray-500">Sem registros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
