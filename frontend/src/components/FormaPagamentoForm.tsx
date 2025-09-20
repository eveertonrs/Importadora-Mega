// src/components/FormaPagamentoForm.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

type Forma = { id: number; descricao: string; ativo: boolean };

export default function FormaPagamentoForm() {
  const [rows, setRows] = useState<Forma[]>([]);
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.descricao.toLowerCase().includes(q) ||
        String(r.id).includes(q) ||
        (r.ativo ? "sim" : "não").includes(q)
    );
  }, [rows, filter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/pagamentos/formas");
      setRows(data?.data ?? data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Falha ao carregar formas de pagamento.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!descricao.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/pagamentos/formas", { descricao: descricao.trim(), ativo: true });
      setDescricao("");
      await load();
      alert("Forma cadastrada com sucesso!");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Não foi possível cadastrar a forma.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(f: Forma) {
    // otimismo: atualiza local antes, reverte se falhar
    const prev = [...rows];
    setRows((list) => list.map((x) => (x.id === f.id ? { ...x, ativo: !x.ativo } : x)));
    try {
      // ajuste aqui caso tua rota seja PATCH/PUT diferente:
      await api.put(`/pagamentos/formas/${f.id}`, { ...f, ativo: !f.ativo });
    } catch (e: any) {
      console.error(e);
      setRows(prev);
      alert("Não foi possível atualizar o status. Tente novamente.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && descricao.trim() && !saving) {
      save();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Formas de Pagamento</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Filtrar (id, descrição, ativo)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            className="border rounded px-3 py-2 flex-1 min-w-[220px]"
            placeholder="Descrição (ex.: Cheque, Boleto 30/60/90...)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={saving}
          />
          <button
            onClick={save}
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!descricao.trim() || saving}
          >
            {saving ? "Salvando..." : "Adicionar"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border">#</th>
              <th className="p-2 border text-left">Descrição</th>
              <th className="p-2 border">Ativo</th>
              <th className="p-2 border">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="p-4 text-center">
                  Carregando…
                </td>
              </tr>
            )}

            {!loading && filtered.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="p-2 border w-16 text-center">{f.id}</td>
                <td className="p-2 border">{f.descricao}</td>
                <td className="p-2 border w-24 text-center">
                  <span
                    className={[
                      "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium",
                      f.ativo ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                    ].join(" ")}
                  >
                    {f.ativo ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="p-2 border w-40">
                  <div className="flex justify-center">
                    <button
                      onClick={() => toggleAtivo(f)}
                      className={[
                        "px-3 py-1 rounded border",
                        f.ativo
                          ? "bg-white hover:bg-slate-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-700",
                      ].join(" ")}
                      title={f.ativo ? "Desativar" : "Ativar"}
                    >
                      {f.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  {rows.length === 0
                    ? "Sem formas cadastradas"
                    : "Nenhum resultado para o filtro"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
