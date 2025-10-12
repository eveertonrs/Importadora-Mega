// src/components/TransportadoraForm.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

/* ===================== Tipos ===================== */
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

/* ===================== Helpers ===================== */
const toStr = (v?: string | null) => v ?? "";
const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const maskCNPJ = (v: string) =>
  onlyDigits(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const maskPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

/* Paleta leve para avatares */
const hue = (s: string) =>
  (Array.from(s).reduce((a, c) => a + c.charCodeAt(0), 0) % 10) * 36;

/* ===================== Componente ===================== */
export default function TransportadoraForm() {
  /* -------- listagem -------- */
  const [rows, setRows] = useState<Transp[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  /* -------- criação -------- */
  const [showCreate, setShowCreate] = useState(false);
  const [nzRazao, setNzRazao] = useState("");
  const [nzCnpj, setNzCnpj] = useState("");
  const [nzForma, setNzForma] = useState("");
  const [nzTel, setNzTel] = useState("");
  const [nzEnd, setNzEnd] = useState("");
  const [nzRef, setNzRef] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  /* -------- edição inline -------- */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Transp | null>(null);
  const isEditing = (id: number) => editingId === id;

  async function load(opts?: { keepPage?: boolean }) {
    setLoading(true);
    try {
      const { data } = await api.get<Page<Transp>>("/transportadoras", {
        params: { page: opts?.keepPage ? page : 1, limit, search: search.trim() || undefined },
      });
      setRows(data?.data ?? []);
      setTotal(Number(data?.total ?? 0));
      if (!opts?.keepPage) setPage(Number(data?.page ?? 1));
    } finally {
      setLoading(false);
    }
  }

  // debounce do filtro
  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, limit]);

  useEffect(() => {
    load({ keepPage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* -------- criar -------- */
  async function create() {
    if (!nzRazao.trim()) return;
    setSavingNew(true);
    try {
      const payload: Partial<Transp> = {
        razao_social: nzRazao.trim(),
        ativo: true,
        cnpj: nzCnpj ? onlyDigits(nzCnpj) : undefined,
        forma_envio: nzForma || undefined,
        telefone: nzTel ? onlyDigits(nzTel) : undefined,
        endereco: nzEnd || undefined,
        referencia: nzRef || undefined,
      };
      await api.post("/transportadoras", payload);
      setNzRazao("");
      setNzCnpj("");
      setNzForma("");
      setNzTel("");
      setNzEnd("");
      setNzRef("");
      setShowCreate(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Não foi possível criar.");
      console.error(e);
    } finally {
      setSavingNew(false);
    }
  }

  /* -------- editar -------- */
  function startEdit(t: Transp) {
    setEditingId(t.id);
    setEdit({ ...t });
  }
  function cancelEdit() {
    setEditingId(null);
    setEdit(null);
  }
  async function saveEdit() {
    if (!edit) return;
    setLoading(true);
    try {
      const { id, ...body } = {
        ...edit,
        cnpj: edit.cnpj ? onlyDigits(edit.cnpj) : null,
        telefone: edit.telefone ? onlyDigits(edit.telefone) : null,
      };
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

  /* -------- ativar/inativar -------- */
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

  /* -------- excluir -------- */
  async function remove(t: Transp) {
    if (!confirm(`Excluir "${t.razao_social}"?`)) return;
    setLoading(true);
    try {
      await api.delete(`/transportadoras/${t.id}`);
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
    <div className="space-y-6">
      {/* HERO dark */}
      <div className="rounded-3xl bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-lg ring-1 ring-black/10">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Transportadoras</h1>
            <p className="text-sm/6 text-slate-300">
              Cadastre e gerencie empresas de transporte.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                className="w-80 rounded-xl bg-white/10 px-3 py-2 pl-9 text-white placeholder:text-slate-300/70 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/40"
                placeholder="Buscar (razão social, CNPJ, telefone)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
                🔎
              </span>
            </div>

            <select
              className="rounded-xl bg-white/10 px-3 py-2 outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-white/40"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/página
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-xl bg-white px-4 py-2 font-medium text-slate-900 hover:bg-slate-100 active:bg-slate-200"
            >
              {showCreate ? "Ocultar cadastro" : "Novo cadastro"}
            </button>
          </div>
        </div>
      </div>

      {/* Card de cadastro (toggle) */}
      {showCreate && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Nova transportadora</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Razão social *</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={nzRazao}
                onChange={(e) => setNzRazao(e.target.value)}
                placeholder="Ex.: Trans Metal LTDA"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">CNPJ</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={nzCnpj}
                onChange={(e) => setNzCnpj(maskCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Forma de envio</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={nzForma}
                onChange={(e) => setNzForma(e.target.value)}
                placeholder="Rodoviário, Retira, Motoboy…"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Telefone</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={nzTel}
                onChange={(e) => setNzTel(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Referência (p/ motorista)</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={nzRef}
                onChange={(e) => setNzRef(e.target.value)}
                placeholder="Próximo ao galpão azul"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Endereço</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={nzEnd}
                onChange={(e) => setNzEnd(e.target.value)}
                placeholder="Rua/Av, nº, bairro, cidade/UF"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              onClick={create}
              disabled={savingNew || !nzRazao.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingNew ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="text-left text-slate-600">
                <th className="p-3 border">Razão social</th>
                <th className="p-3 border w-44">CNPJ</th>
                <th className="p-3 border w-40">Forma envio</th>
                <th className="p-3 border w-40">Telefone</th>
                <th className="p-3 border">Endereço</th>
                <th className="p-3 border w-[220px]">Referência</th>
                <th className="p-3 border w-28">Status</th>
                <th className="p-3 border w-[220px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="p-3 border">
                        <div className="h-4 w-full max-w-[180px] rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                rows.map((t, idx) => (
                  <tr
                    key={t.id}
                    className={["transition-colors", idx % 2 ? "bg-slate-50/40" : "", "hover:bg-slate-50"].join(
                      " "
                    )}
                  >
                    {/* Razão social com avatar */}
                    <td className="p-3 border align-top">
                      <div className="flex items-start gap-3">
                        <span
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: `hsl(${hue(t.razao_social)} 80% 45%)` as any }}
                        >
                          {initials(t.razao_social)}
                        </span>
                        {isEditing(t.id) ? (
                          <input
                            className="mt-0.5 w-full rounded border px-2 py-1"
                            value={toStr(edit?.razao_social)}
                            onChange={(e) =>
                              setEdit((s) => ({ ...(s as Transp), razao_social: e.target.value }))
                            }
                          />
                        ) : (
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">
                              {t.razao_social}
                            </div>
                            {t.referencia && (
                              <div className="truncate text-xs text-slate-500">{t.referencia}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* CNPJ */}
                    <td className="p-3 border align-top">
                      {isEditing(t.id) ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={toStr(edit?.cnpj ?? "")}
                          onChange={(e) =>
                            setEdit((s) => ({ ...(s as Transp), cnpj: maskCNPJ(e.target.value) }))
                          }
                          inputMode="numeric"
                        />
                      ) : t.cnpj ? (
                        maskCNPJ(t.cnpj)
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Forma envio */}
                    <td className="p-3 border align-top">
                      {isEditing(t.id) ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={toStr(edit?.forma_envio)}
                          onChange={(e) =>
                            setEdit((s) => ({ ...(s as Transp), forma_envio: e.target.value }))
                          }
                        />
                      ) : (
                        t.forma_envio ?? "—"
                      )}
                    </td>

                    {/* Telefone */}
                    <td className="p-3 border align-top">
                      {isEditing(t.id) ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={toStr(edit?.telefone ?? "")}
                          onChange={(e) =>
                            setEdit((s) => ({ ...(s as Transp), telefone: maskPhone(e.target.value) }))
                          }
                          inputMode="tel"
                        />
                      ) : t.telefone ? (
                        <a
                          className="text-blue-700 underline decoration-1 underline-offset-2"
                          href={`tel:${onlyDigits(t.telefone)}`}
                        >
                          {maskPhone(t.telefone)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Endereço */}
                    <td className="p-3 border align-top">
                      {isEditing(t.id) ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={toStr(edit?.endereco)}
                          onChange={(e) => setEdit((s) => ({ ...(s as Transp), endereco: e.target.value }))}
                        />
                      ) : (
                        t.endereco ?? "—"
                      )}
                    </td>

                    {/* Referência (col resumida na tabela, já mostramos no título) */}
                    <td className="p-3 border align-top">{t.referencia ?? "—"}</td>

                    {/* Status */}
                    <td className="p-3 border align-top">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                          t.ativo
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-200 text-slate-700 ring-0",
                        ].join(" ")}
                      >
                        {t.ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="p-3 border align-top">
                      {isEditing(t.id) ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                            onClick={saveEdit}
                          >
                            Salvar
                          </button>
                          <button
                            className="rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                            onClick={cancelEdit}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                            onClick={() => startEdit(t)}
                          >
                            Editar
                          </button>
                          <button
                            className={[
                              "rounded-lg px-3 py-1.5",
                              t.ativo
                                ? "border text-amber-700 hover:bg-amber-50"
                                : "bg-emerald-600 text-white hover:bg-emerald-700",
                            ].join(" ")}
                            onClick={() => toggleActive(t)}
                          >
                            {t.ativo ? "Inativar" : "Ativar"}
                          </button>
                          <button
                            className="rounded-lg border px-3 py-1.5 text-red-700 hover:bg-rose-50"
                            onClick={() => remove(t)}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    Nenhuma transportadora encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer da lista */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3 text-sm">
          <div className="text-slate-600">
            Mostrando <b>{rows.length}</b> de <b>{total}</b> registro(s).
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border px-3 py-1.5 hover:bg-white disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              ‹ Anterior
            </button>
            <div className="px-1">
              Página <b>{page}</b> / {Math.max(1, totalPages)}
            </div>
            <button
              className="rounded-xl border px-3 py-1.5 hover:bg-white disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Próxima ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
