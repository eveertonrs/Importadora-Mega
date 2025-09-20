// src/components/TransportadoraForm.tsx
import { useEffect, useState } from "react";
import api from "../services/api";

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

export default function TransportadoraForm() {
  const [rows, setRows] = useState<Transp[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [formaEnvio, setFormaEnvio] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [referencia, setReferencia] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/transportadoras");
      setRows(data?.data ?? data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!razaoSocial.trim()) return;

    setLoading(true);
    try {
      await api.post("/transportadoras", {
        razao_social: razaoSocial.trim(),
        cnpj: cnpj.trim() || null,
        forma_envio: formaEnvio.trim() || null,
        telefone: telefone.trim() || null,
        endereco: endereco.trim() || null,
        referencia: referencia.trim() || null,
        ativo: true,
      });
      // reset
      setRazaoSocial("");
      setCnpj("");
      setFormaEnvio("");
      setTelefone("");
      setEndereco("");
      setReferencia("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Transportadoras</h1>

      {/* FORM */}
      <div className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Razão social*</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="Ex.: Trans Metal LTDA"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">CNPJ</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Forma de envio</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="Ex.: Rodoviário, Retira, Motoboy..."
              value={formaEnvio}
              onChange={(e) => setFormaEnvio(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Telefone</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Referência (p/ motorista)</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="Ex.: Próximo ao galpão azul"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Endereço</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="Rua/Av, nº, bairro, cidade/UF"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-1">
          <button
            onClick={save}
            disabled={loading || !razaoSocial.trim()}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2 border">#</th>
              <th className="p-2 border">Razão social</th>
              <th className="p-2 border">CNPJ</th>
              <th className="p-2 border">Forma envio</th>
              <th className="p-2 border">Telefone</th>
              <th className="p-2 border">Endereço</th>
              <th className="p-2 border">Referência</th>
              <th className="p-2 border">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="p-2 border">{t.id}</td>
                <td className="p-2 border">{t.razao_social}</td>
                <td className="p-2 border">{t.cnpj ?? "-"}</td>
                <td className="p-2 border">{t.forma_envio ?? "-"}</td>
                <td className="p-2 border">{t.telefone ?? "-"}</td>
                <td className="p-2 border">{t.endereco ?? "-"}</td>
                <td className="p-2 border">{t.referencia ?? "-"}</td>
                <td className="p-2 border">{t.ativo ? "Sim" : "Não"}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  Sem registros
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  Carregando…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
