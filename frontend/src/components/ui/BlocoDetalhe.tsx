// src/components/ui/BlocoDetalhe.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getBloco,
  listarPedidosDoBloco,
  vincularPedido,
  desvincularPedido,
  listarLancamentos,
  adicionarLancamento,
  getSaldo,
  fecharBloco,
} from "../../services/blocos.api";
import api from "../../services/api";
import type { TipoReceb, LancStatus } from "../../services/blocos.api";

type DetBloco = Awaited<ReturnType<typeof getBloco>>;
type TipoStr = TipoReceb | (string & {});

/** extras que podem aparecer mesmo não estando na tabela de formas */
const TIPOS_SISTEMICOS: string[] = [
  "PEDIDO",
  "DEVOLUCAO",
  "BONIFICACAO",
  "DESCONTO A VISTA",
  "TROCA",
];

export default function BlocoDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const blocoId = Number(id);

  const [b, setB] = useState<DetBloco | null>(null);
  const [saldo, setSaldo] = useState<number>(0);

  const [tab, setTab] = useState<"pedidos" | "lancamentos" | "resumo">("pedidos");

  // pedidos
  const [pedidos, setPedidos] = useState<
    Array<{ id: number; pedido_id: number; criado_em?: string }>
  >([]);
  const [pPage, setPPage] = useState(1);
  const [pLimit, setPLimit] = useState(25);

  // novo vínculo de pedido
  const [npId, setNpId] = useState<number | "">("");
  const [npVal, setNpVal] = useState<string>("");
  const [savingPed, setSavingPed] = useState(false);

  // lançamentos
  const [lancs, setLancs] = useState<
    Array<{
      id: number;
      tipo_recebimento: string;
      sentido: "ENTRADA" | "SAIDA";
      valor: number;
      data_lancamento: string;
      status: LancStatus;
      numero_referencia?: string | null;
      observacao?: string | null;
    }>
  >([]);
  const [lPage, setLPage] = useState(1);
  const [lLimit, setLLimit] = useState(25);
  const [fStatus, setFStatus] = useState<"" | LancStatus>("");
  const [fTipo, setFTipo] = useState<"" | TipoStr>("");

  /** ▼▼ Formas dinâmicas ▼▼ **/
  const [formas, setFormas] = useState<string[]>([
    // fallback inicial
    "PIX",
    "DINHEIRO",
    "DEPOSITO",
    "BOLETO",
    "CHEQUE",
  ]);
  // novo lançamento
  const [tipo, setTipo] = useState<TipoStr>(formas[0] as TipoStr);
  /** ▲▲ Formas dinâmicas ▲▲ **/

  const [valor, setValor] = useState<string>("");
  const [dataLanc, setDataLanc] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [bomPara, setBomPara] = useState<string>("");
  const [tipoCheque, setTipoCheque] = useState<"" | "PROPRIO" | "TERCEIRO">("");
  const [numRef, setNumRef] = useState("");
  const [obs, setObs] = useState("");
  const [savingLanc, setSavingLanc] = useState(false);

  const isCheque = String(tipo).toUpperCase() === "CHEQUE";
  const podeFechar = useMemo(
    () => b?.status === "ABERTO" && Number(saldo) === 0,
    [b?.status, saldo]
  );

  /** carrega formas do backend e ajusta selects */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/pagamentos/formas");
        // aceita vários formatos: [{id, descricao, ativo}], [{nome, ativo}], ["PIX",...]
        const brutas: any[] = data?.data ?? data ?? [];
        const ativas = brutas
          .map((f) =>
            typeof f === "string"
              ? f
              : f?.descricao ?? f?.nome ?? f?.nome_fantasia ?? ""
          )
          .filter((n) => !!n)
          // se vier flag "ativo", respeita; se não vier, considera
          .filter((_, idx) => {
            const f = brutas[idx];
            return typeof f === "object" && "ativo" in f ? !!f.ativo : true;
          })
          .map((s: string) => s.toUpperCase().trim());

        // junta sistêmicos + únicas
        const lista = Array.from(new Set([...ativas, ...TIPOS_SISTEMICOS]));
        if (lista.length) {
          setFormas(lista);
          // garante que o "tipo" atual exista
          setTipo((prev) => (lista.includes(String(prev)) ? prev : (lista[0] as TipoStr)));
          // também atualiza opções do filtro "Tipo"
          setFTipo((prev) => (prev && lista.includes(String(prev)) ? prev : ""));
        }
      } catch {
        // segue com fallback
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [det, s] = await Promise.all([getBloco(blocoId), getSaldo(blocoId)]);
    setB(det);
    setSaldo(Number(s?.saldo ?? 0));
  }

  async function loadPedidos() {
    const r = await listarPedidosDoBloco(blocoId, { page: pPage, limit: pLimit });
    setPedidos(r?.data ?? []);
  }

  async function loadLancs() {
    const r = await listarLancamentos(blocoId, {
      page: lPage,
      limit: lLimit,
      status: (fStatus || undefined) as any,
      tipo: (fTipo || undefined) as any,
    });
    setLancs(r?.data ?? []);
    const s = await getSaldo(blocoId);
    setSaldo(Number(s?.saldo ?? 0));
  }

  useEffect(() => {
    if (!Number.isFinite(blocoId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!Number.isFinite(blocoId)) return;
    loadPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pPage, pLimit]);

  useEffect(() => {
    if (!Number.isFinite(blocoId)) return;
    loadLancs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lPage, lLimit, fStatus, fTipo]);

  async function doVincularPedido() {
    if (!npId || Number.isNaN(Number(npId))) {
      alert("Informe o ID do pedido.");
      return;
    }
    setSavingPed(true);
    try {
      const valorPedido =
        npVal.trim() === "" ? undefined : Number(npVal.replace(",", "."));
      await vincularPedido(blocoId, {
        pedido_id: Number(npId),
        valor_pedido: valorPedido,
      });
      setNpId("");
      setNpVal("");
      await Promise.all([loadPedidos(), loadLancs()]);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao vincular pedido.");
    } finally {
      setSavingPed(false);
    }
  }

  async function doDesvincularPedido(pid: number) {
    if (!confirm("Desvincular pedido do bloco?")) return;
    try {
      await desvincularPedido(blocoId, pid);
      await Promise.all([loadPedidos(), loadLancs()]);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao desvincular pedido.");
    }
  }

  async function doAddLanc() {
    if (!valor.trim()) {
      alert("Informe o valor.");
      return;
    }
    if (isCheque && (!tipoCheque || !bomPara)) {
      alert("Para CHEQUE, selecione o tipo e preencha o 'Bom para'.");
      return;
    }
    setSavingLanc(true);
    try {
      await adicionarLancamento(blocoId, {
        tipo_recebimento: tipo as TipoReceb, // runtime ok (lista vem do backend)
        valor: Number(valor.replace(",", ".")),
        data_lancamento: dataLanc, // yyyy-mm-dd
        bom_para: isCheque ? bomPara : undefined,
        tipo_cheque: isCheque ? (tipoCheque as "PROPRIO" | "TERCEIRO") : undefined,
        numero_referencia: numRef || undefined,
        observacao: obs || undefined,
      } as any);
      // limpa
      setValor("");
      setNumRef("");
      setObs("");
      if (isCheque) {
        setBomPara("");
        setTipoCheque("");
      }
      await loadLancs();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao adicionar lançamento.");
    } finally {
      setSavingLanc(false);
    }
  }

  async function doFechar() {
    if (!confirm("Fechar este bloco? Depois de fechado não aceita novos lançamentos.")) return;
    try {
      await fecharBloco(blocoId);
      await load();
      await loadLancs();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao fechar bloco.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => nav(-1)} className="px-3 py-2 rounded border hover:bg-slate-50">
            ← Voltar
          </button>
          <h1 className="text-xl font-semibold">
            Bloco #{b?.id} <span className="text-slate-400">• {b?.codigo}</span>
          </h1>
          {b && (
            <span
              className={
                "text-[11px] px-2 py-0.5 rounded-full font-medium " +
                (b.status === "ABERTO" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700")
              }
            >
              {b.status}
            </span>
          )}
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Saldo</div>
          <div
            className={[
              "text-lg font-semibold",
              saldo < 0 ? "text-red-700" : saldo > 0 ? "text-emerald-700" : "text-slate-800",
            ].join(" ")}
          >
            {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="pt-2">
            <button
              onClick={doFechar}
              disabled={!podeFechar}
              className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              title={podeFechar ? "" : "Só é possível fechar com saldo 0 e status ABERTO"}
            >
              Fechar bloco
            </button>
          </div>
        </div>
      </div>

      {/* abas */}
      <div className="flex gap-2">
        {(["pedidos", "lancamentos", "resumo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-2 rounded border",
              tab === t ? "bg-slate-800 text-white" : "bg-white hover:bg-slate-50",
            ].join(" ")}
          >
            {t === "pedidos" ? "Pedidos" : t === "lancamentos" ? "Lançamentos" : "Resumo"}
          </button>
        ))}
      </div>

      {/* conteúdo das abas */}
      {tab === "pedidos" && (
        <div className="space-y-4">
          {/* form vincular */}
          <div className="rounded border bg-white p-4">
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-sm">ID do pedido</label>
                <input
                  className="mt-1 border rounded px-3 py-2 w-full"
                  value={npId}
                  onChange={(e) => setNpId((e.target.value as any) as number | "")}
                  placeholder="ex.: 1001"
                />
              </div>
              <div>
                <label className="text-sm">Valor (opcional)</label>
                <input
                  className="mt-1 border rounded px-3 py-2 w-full"
                  value={npVal}
                  onChange={(e) => setNpVal(e.target.value)}
                  placeholder="ex.: 500,00"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  className="mt-6 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={doVincularPedido}
                  disabled={savingPed}
                >
                  {savingPed ? "Vinculando..." : "Vincular pedido"}
                </button>
              </div>
            </div>
          </div>

          {/* lista pedidos */}
          <div className="rounded border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Pedido</th>
                  <th className="p-2 border">Criado em</th>
                  <th className="p-2 border">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 border">{p.id}</td>
                    <td className="p-2 border">{p.pedido_id}</td>
                    <td className="p-2 border">{p.criado_em ?? "-"}</td>
                    <td className="p-2 border">
                      <button
                        onClick={() => doDesvincularPedido(p.pedido_id)}
                        className="text-red-700 underline"
                      >
                        Desvincular
                      </button>
                    </td>
                  </tr>
                ))}
                {pedidos.length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-slate-500" colSpan={4}>
                      Nenhum pedido vinculado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* paginação pedidos */}
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 rounded border"
              onClick={() => setPPage((p) => Math.max(1, p - 1))}
            >
              ◀
            </button>
            <span className="text-sm">Página {pPage}</span>
            <button className="px-2 py-1 rounded border" onClick={() => setPPage((p) => p + 1)}>
              ▶
            </button>
            <select
              className="ml-3 border rounded px-2 py-1"
              value={pLimit}
              onChange={(e) => setPLimit(Number(e.target.value))}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/pág
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {tab === "lancamentos" && (
        <div className="space-y-4">
          {/* filtros lançamentos */}
          <div className="rounded border bg-white p-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm">Status</label>
              <select
                className="mt-1 border rounded px-3 py-2"
                value={fStatus}
                onChange={(e) => setFStatus((e.target.value as LancStatus) || "")}
              >
                <option value="">(todos)</option>
                <option value="PENDENTE">PENDENTE</option>
                <option value="LIQUIDADO">LIQUIDADO</option>
                <option value="DEVOLVIDO">DEVOLVIDO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </div>
            <div>
              <label className="text-sm">Tipo</label>
              <select
                className="mt-1 border rounded px-3 py-2"
                value={fTipo}
                onChange={(e) => setFTipo((e.target.value as TipoStr) || "")}
              >
                <option value="">(todos)</option>
                {formas.concat(
                  TIPOS_SISTEMICOS.filter((t) => !formas.includes(t))
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button className="px-3 py-2 rounded border" onClick={loadLancs}>
              Atualizar
            </button>
          </div>

          {/* form novo lançamento */}
          <div className="rounded border bg-white p-4">
            <div className="grid md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm">Forma</label>
                <select
                  className="mt-1 border rounded px-3 py-2 w-full"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoStr)}
                >
                  {formas.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Valor</label>
                <input
                  className="mt-1 border rounded px-3 py-2 w-full"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-sm">Data</label>
                <input
                  type="date"
                  className="mt-1 border rounded px-3 py-2 w-full"
                  value={dataLanc}
                  onChange={(e) => setDataLanc(e.target.value)}
                />
              </div>

              {isCheque && (
                <>
                  <div>
                    <label className="text-sm">Tipo de cheque</label>
                    <select
                      className="mt-1 border rounded px-3 py-2 w-full"
                      value={tipoCheque}
                      onChange={(e) =>
                        setTipoCheque((e.target.value as "PROPRIO" | "TERCEIRO") || "")
                      }
                    >
                      <option value="">(selecione)</option>
                      <option value="PROPRIO">PRÓPRIO</option>
                      <option value="TERCEIRO">TERCEIRO</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm">Bom para</label>
                    <input
                      type="date"
                      className="mt-1 border rounded px-3 py-2 w-full"
                      value={bomPara}
                      onChange={(e) => setBomPara(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-3">
                <label className="text-sm">Referência</label>
                <input
                  className="mt-1 border rounded px-3 py-2 w-full"
                  value={numRef}
                  onChange={(e) => setNumRef(e.target.value)}
                  placeholder="nº cheque / obs curta"
                />
              </div>
              <div className="md:col-span-6">
                <label className="text-sm">Observação</label>
                <input
                  className="mt-1 border rounded px-3 py-2 w-full"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </div>
              <div className="md:col-span-6">
                <button
                  onClick={doAddLanc}
                  disabled={savingLanc}
                  className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingLanc ? "Salvando..." : "Adicionar lançamento"}
                </button>
              </div>
            </div>
          </div>

          {/* lista */}
          <div className="rounded border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Tipo</th>
                  <th className="p-2 border">Sentido</th>
                  <th className="p-2 border">Valor</th>
                  <th className="p-2 border">Data</th>
                  <th className="p-2 border">Status</th>
                  <th className="p-2 border">Ref</th>
                  <th className="p-2 border">Obs</th>
                </tr>
              </thead>
              <tbody>
                {lancs.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2 border">{l.id}</td>
                    <td className="p-2 border">{l.tipo_recebimento}</td>
                    <td className="p-2 border">{l.sentido}</td>
                    <td className="p-2 border">
                      {Number(l.valor).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-2 border">{String(l.data_lancamento).slice(0, 10)}</td>
                    <td className="p-2 border">{l.status}</td>
                    <td className="p-2 border">{l.numero_referencia ?? "-"}</td>
                    <td className="p-2 border">{l.observacao ?? "-"}</td>
                  </tr>
                ))}
                {lancs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-500">
                      Nenhum lançamento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* paginação lançamentos */}
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 rounded border"
              onClick={() => setLPage((p) => Math.max(1, p - 1))}
            >
              ◀
            </button>
            <span className="text-sm">Página {lPage}</span>
            <button className="px-2 py-1 rounded border" onClick={() => setLPage((p) => p + 1)}>
              ▶
            </button>
            <select
              className="ml-3 border rounded px-2 py-1"
              value={lLimit}
              onChange={(e) => setLLimit(Number(e.target.value))}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/pág
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {tab === "resumo" && (
        <div className="rounded border bg-white p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">Cliente</div>
              <div className="font-medium">{b?.cliente_nome ?? b?.cliente_id}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Código</div>
              <div className="font-medium">{b?.codigo}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Aberto em</div>
              <div className="font-medium">
                {b?.aberto_em ? String(b.aberto_em).replace("T", " ").slice(0, 19) : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Fechado em</div>
              <div className="font-medium">
                {b?.fechado_em ? String(b.fechado_em).replace("T", " ").slice(0, 19) : "-"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
