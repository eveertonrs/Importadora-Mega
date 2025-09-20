// src/components/ui/BlocoDetalhe.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  obterBloco,
  getSaldo,
  listarPedidosDoBloco,
  listarLancamentosDoBloco,
  vincularPedido,
  desvincularPedido,
  criarLancamento,
  fecharBlocoApi,
} from "../../services/blocos.api";

import type {
  Bloco as TBloco,
  VinculoPedidoDTO,
  LancamentoDTO,
} from "../../services/blocos.api";

/* ------------ helpers UI ------------ */
const fmtBRL = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Badge = ({ tone = "slate", children }: { tone?: "blue" | "slate" | "green" | "red"; children: React.ReactNode }) => {
  const map: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    slate: "bg-slate-200 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${map[tone]}`}>
      {children}
    </span>
  );
};

export default function BlocoDetalhe() {
  const { id } = useParams();
  const blocoId = useMemo(() => Number(id), [id]);

  const [bloco, setBloco] = useState<TBloco | null>(null);
  const [saldo, setSaldo] = useState<number>(0);
  const [pedidos, setPedidos] = useState<VinculoPedidoDTO[]>([]);
  const [lancs, setLancs] = useState<LancamentoDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false); // ações de formulário

  // forms
  const [pedidoId, setPedidoId] = useState<number | "">("");
  const [valorPedido, setValorPedido] = useState<number | "">("");
  const [tipo, setTipo] = useState<LancamentoDTO["tipo_recebimento"]>("PIX");
  const [valor, setValor] = useState<number | "">("");
  const [observacao, setObservacao] = useState("");

  async function loadAll() {
    if (!Number.isFinite(blocoId)) return;
    setLoading(true);
    try {
      const [b, s, p, l] = await Promise.all([
        obterBloco(blocoId),
        getSaldo(blocoId),
        listarPedidosDoBloco(blocoId, { page: 1, limit: 100 }),
        listarLancamentosDoBloco(blocoId, { page: 1, limit: 200 }),
      ]);
      setBloco(b);
      setSaldo(s.saldo ?? 0);
      setPedidos(p.data ?? []);
      setLancs(l.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocoId]);

  async function onVincular() {
    if (pedidoId === "") return;
    setBusy(true);
    try {
      await vincularPedido(blocoId, {
        pedido_id: Number(pedidoId),
        valor_pedido: valorPedido === "" ? undefined : Number(valorPedido),
      });
      setPedidoId("");
      setValorPedido("");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function onDesvincular(pId: number) {
    setBusy(true);
    try {
      await desvincularPedido(blocoId, pId);
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function onLancamento() {
    if (valor === "") return;
    setBusy(true);
    try {
      await criarLancamento(
        blocoId,
        {
          tipo_recebimento: tipo,
          valor: Number(valor),
          data_lancamento: new Date().toISOString(),
          status: "PENDENTE",
          observacao: observacao || undefined,
          numero_referencia: undefined,
          bom_para: undefined,
          tipo_cheque: undefined,
        } as Omit<LancamentoDTO, "id" | "sentido" | "criado_em" | "bloco_id">
      );
      setValor("");
      setObservacao("");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function onFechar() {
    setBusy(true);
    try {
      await fecharBlocoApi(blocoId);
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  const isFechavel = bloco?.status === "ABERTO" && saldo === 0;

  return (
    <div className="p-4 space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/blocos"
            className="inline-flex items-center px-3 py-1.5 rounded-md border hover:bg-slate-50"
          >
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">
            Bloco <span className="text-slate-500">#{blocoId}</span>
          </h1>
        </div>

        {bloco?.status && (
          <Badge tone={bloco.status === "ABERTO" ? "blue" : "slate"}>
            {bloco.status}
          </Badge>
        )}
      </div>

      {/* cards topo */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-sm text-slate-500 mb-2">Dados do bloco</div>
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-40 bg-slate-200 rounded" />
              <div className="h-4 w-52 bg-slate-200 rounded" />
              <div className="h-4 w-44 bg-slate-200 rounded" />
            </div>
          ) : bloco ? (
            <div className="space-y-1.5">
              <div><b>Código:</b> {bloco.codigo}</div>
              <div><b>Cliente:</b> {bloco.cliente_nome ?? bloco.cliente_id}</div>
              <div>
                <b>Aberto em:</b>{" "}
                {bloco.aberto_em ? new Date(bloco.aberto_em).toLocaleString() : "-"}
              </div>
              {bloco.fechado_em && (
                <div>
                  <b>Fechado em:</b>{" "}
                  {new Date(bloco.fechado_em).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500">Bloco não encontrado.</div>
          )}
        </div>

        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-sm text-slate-500 mb-2">Saldo (ENTRADA − SAÍDA)</div>
          <div
            className={`text-3xl font-bold ${
              saldo === 0 ? "text-slate-800" : saldo > 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {fmtBRL(saldo)}
          </div>
          <button
            disabled={!isFechavel || busy}
            onClick={onFechar}
            className="mt-3 px-3 py-2 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            title={isFechavel ? "Fechar bloco" : "Para fechar, o saldo precisa ser 0 e o status ABERTO"}
          >
            Fechar bloco
          </button>
          {!isFechavel && (
            <div className="mt-2 text-xs text-slate-500">
              Para fechar, o saldo deve ser 0 e o bloco precisa estar ABERTO.
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl border bg-white shadow-sm">
          <div className="text-sm font-medium mb-2">Vincular pedido</div>
          <div className="flex flex-wrap gap-2">
            <input
              className="border rounded px-2 py-2 w-32"
              placeholder="pedido_id"
              value={pedidoId}
              onChange={(e) => setPedidoId(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <input
              className="border rounded px-2 py-2 w-40"
              placeholder="valor (opcional)"
              value={valorPedido}
              onChange={(e) =>
                setValorPedido(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
            <button
              onClick={onVincular}
              className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={busy || pedidoId === ""}
            >
              Vincular
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Informe o número do pedido. O valor é apenas informativo (opcional).
          </div>
        </div>
      </div>

      {/* Pedidos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Pedidos vinculados</h2>
          <div className="text-xs text-slate-500">{pedidos.length} itens</div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 border-b text-left">Pedido</th>
                <th className="p-2 border-b text-left">Vínculo em</th>
                <th className="p-2 border-b text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-2 border-b">{p.pedido_id}</td>
                  <td className="p-2 border-b">
                    {p.criado_em ? new Date(p.criado_em).toLocaleString() : "-"}
                  </td>
                  <td className="p-2 border-b">
                    <button
                      onClick={() => onDesvincular(p.pedido_id)}
                      className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      disabled={busy}
                    >
                      Desvincular
                    </button>
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-500">
                    Nenhum pedido vinculado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lançamentos */}
      <section className="space-y-3">
        <h2 className="font-semibold">Lançamentos</h2>

        <div className="flex flex-wrap gap-2 items-end rounded-lg border p-3">
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select
              className="border rounded px-2 py-2 block"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as LancamentoDTO["tipo_recebimento"])}
            >
              {[
                "CHEQUE",
                "DINHEIRO",
                "BOLETO",
                "DEPOSITO",
                "PIX",
                "TROCA",
                "BONIFICACAO",
                "DESCONTO A VISTA",
                "DEVOLUCAO",
                "PEDIDO",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Valor</label>
            <input
              className="border rounded px-2 py-2 w-36"
              value={valor}
              onChange={(e) => setValor(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0,00"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm mb-1">Observação</label>
            <input
              className="border rounded px-2 py-2 w-full"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <button
            onClick={onLancamento}
            className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={busy || valor === ""}
          >
            Adicionar
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 border-b text-left">#</th>
                <th className="p-2 border-b text-left">Tipo</th>
                <th className="p-2 border-b text-left">Sentido</th>
                <th className="p-2 border-b text-left">Valor</th>
                <th className="p-2 border-b text-left">Status</th>
                <th className="p-2 border-b text-left">Ref</th>
                <th className="p-2 border-b text-left">Data</th>
                <th className="p-2 border-b text-left">Obs</th>
              </tr>
            </thead>
            <tbody>
              {lancs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="p-2 border-b">{l.id}</td>
                  <td className="p-2 border-b">{l.tipo_recebimento}</td>
                  <td className="p-2 border-b">
                    <Badge tone={l.sentido === "ENTRADA" ? "green" : "red"}>
                      {l.sentido}
                    </Badge>
                  </td>
                  <td className="p-2 border-b">{fmtBRL(l.valor)}</td>
                  <td className="p-2 border-b">
                    <Badge tone={l.status === "PENDENTE" ? "slate" : l.status === "LIQUIDADO" ? "green" : "red"}>
                      {l.status}
                    </Badge>
                  </td>
                  <td className="p-2 border-b">{l.numero_referencia ?? "-"}</td>
                  <td className="p-2 border-b">
                    {l.data_lancamento ? new Date(l.data_lancamento).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-2 border-b">{l.observacao ?? "-"}</td>
                </tr>
              ))}
              {lancs.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Sem lançamentos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
