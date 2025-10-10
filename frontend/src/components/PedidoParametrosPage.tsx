import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

type TipoParam = "ENTRADA" | "SAIDA";
type Param = {
  id: number;
  tipo: TipoParam;
  descricao: string;
  ativo: boolean;
  created_at?: string;
};

export default function PedidoParametrosPage() {
  const [rows, setRows] = useState<Param[]>([]);
  const [descricao, setDescricao] = useState("");
  const [tipoNovo, setTipoNovo] = useState<TipoParam>("ENTRADA");
  const [tab, setTab] = useState<"todos" | TipoParam>("todos");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows
      .filter((r) => (tab === "todos" ? true : r.tipo === tab))
      .filter((r) =>
        !q
          ? true
          : r.descricao.toLowerCase().includes(q) ||
            String(r.id).includes(q) ||
            r.tipo.toLowerCase().includes(q) ||
            (r.ativo ? "sim" : "não").includes(q)
      );
  }, [rows, filter, tab]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab !== "todos") params.set("tipo", tab);
      params.set("ativo", "all");
      const { data } = await api.get(`/pedido-parametros?${params.toString()}`);
      setRows(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha ao carregar parâmetros.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function save() {
    if (!descricao.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/pedido-parametros", {
        tipo: tipoNovo,
        descricao: descricao.trim(),
      });
      setDescricao("");
      await load();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 409
          ? "Já existe um parâmetro com essa descrição."
          : "Não foi possível cadastrar.");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(p: Param) {
    const prev = [...rows];
    setRows((list) => list.map((x) => (x.id === p.id ? { ...x, ativo: !x.ativo } : x)));
    try {
      await api.patch(`/pedido-parametros/${p.id}/toggle`);
    } catch {
      setRows(prev);
      alert("Não foi possível atualizar o status. Tente novamente.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && descricao.trim() && !saving) save();
  }

  const chipTipo = (tipo: TipoParam) =>
    [
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
      tipo === "SAIDA"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-rose-50 text-rose-700 border-rose-200",
    ].join(" ");

  return (
    <div className="space-y-5">
      {/* header coloridinho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-95">
              <path
                fill="currentColor"
                d="M3 5a2 2 0 0 1 2-2h3.5a2 2 0 0 1 1.6.8l1.8 2.4H19a2 2 0 0 1 2 2v9.8A2 2 0 0 1 19 20H5a2 2 0 0 1-2-2V5Z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Parâmetros do pedido</h1>
            <p className="text-xs text-slate-500">Organize os tipos de lançamento usados nos blocos</p>
          </div>
        </div>

        <div className="relative">
          <input
            className="border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 placeholder:text-slate-400"
            placeholder="Filtrar (id, tipo, descrição, ativo)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="m21 20.3l-5.4-5.4a7.4 7.4 0 1 0-1.7 1.7L20.3 22L21 20.3ZM5.5 10a4.5 4.5 0 1 1 9 0a4.5 4.5 0 0 1-9 0Z"
              />
            </svg>
          </span>
        </div>
      </div>

      {/* abas */}
      <div className="flex gap-2">
        {(["todos", "ENTRADA", "SAIDA"] as const).map((t) => {
          const isActive = tab === t;
          const base =
            "px-3.5 py-2 rounded-xl text-sm font-medium border transition-all shadow-sm";
          const styles =
            t === "SAIDA"
              ? isActive
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              : t === "ENTRADA"
              ? isActive
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
              : isActive
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";
          return (
            <button key={t} onClick={() => setTab(t)} className={`${base} ${styles}`}>
              {t === "todos" ? "Todos" : t}
            </button>
          );
        })}
      </div>

      {/* formulário */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
        <div className="p-4 md:p-5 space-y-3">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={tipoNovo}
              onChange={(e) => setTipoNovo(e.target.value as TipoParam)}
              disabled={saving}
            >
              <option value="ENTRADA">ENTRADA</option>
              <option value="SAIDA">SAÍDA</option>
            </select>

            <input
              className="border border-slate-200 rounded-xl px-3 py-2.5 flex-1 min-w-[240px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="Descrição (ex.: PIX, Boleto 30/60/90..., Frete, Imposto...)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={saving}
            />

            <button
              onClick={save}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
              disabled={!descricao.trim() || saving}
            >
              {saving ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>

      {/* grid */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-slate-600">
              <th className="p-2.5 border w-28">Tipo</th>
              <th className="p-2.5 border text-left">Descrição</th>
              <th className="p-2.5 border w-24">Ativo</th>
              <th className="p-2.5 border w-40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="p-2.5 border text-center">
                    <span className={chipTipo(p.tipo)}>{p.tipo}</span>
                  </td>
                  <td className="p-2.5 border">{p.descricao}</td>
                  <td className="p-2.5 border text-center">
                    <span
                      className={[
                        "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                        p.ativo
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200",
                      ].join(" ")}
                    >
                      {p.ativo ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="p-2.5 border">
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleAtivo(p)}
                        className={[
                          "px-3 py-1.5 rounded-xl text-sm font-medium border shadow-sm transition-colors",
                          p.ativo
                            ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
                        ].join(" ")}
                        title={p.ativo ? "Desativar" : "Ativar"}
                      >
                        {p.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  {rows.length === 0 ? "Sem parâmetros cadastrados" : "Nenhum resultado para o filtro"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
