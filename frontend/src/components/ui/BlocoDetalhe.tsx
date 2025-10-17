import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getBloco,
  listarLancamentos,
  adicionarLancamento,
  getSaldo,      // legado (fallback)
  getSaldos,     // novo (saldo + a receber)
  fecharBloco,
  excluirLancamento,       // ⟵ excluir lançamento
} from "../../services/blocos.api";
import api from "../../services/api";

type DetBloco = Awaited<ReturnType<typeof getBloco>>;
type LancStatus = "PENDENTE" | "LIQUIDADO" | "DEVOLVIDO" | "CANCELADO";
type Sentido = "ENTRADA" | "SAIDA";

type ParametroItem = {
  id: number;
  descricao: string;               // ex.: CHEQUE, PIX, BOLETO...
  tipo: "ENTRADA" | "SAIDA";
  ativo: boolean;
  exige_bom_para: boolean;         // se true, pede o campo "bom para"
  exige_tipo_cheque: boolean;      // se true, pede "tipo de cheque"
};

/* ================= helpers de data ================= */
function dateBR(value?: string | Date | null) {
  if (!value) return "—";
  if (typeof value === "string") {
    // cobre "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm[:ss]"
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function dateTimeBR(value?: string | Date | null) {
  if (!value) return "—";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
    const dOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dOnly) return `${dOnly[3]}/${dOnly[2]}/${dOnly[1]}`;
  }
  const d = new Date(value);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function BlocoDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const blocoId = Number(id);

  const [b, setB] = useState<DetBloco | null>(null);

  // Saldos
  const [saldo, setSaldo] = useState<number>(0);       // saldo “normal”
  const [aReceber, setAReceber] = useState<number>(0); // títulos ABERTO/PARCIAL do bloco

  const [tab, setTab] = useState<"lancamentos" | "resumo">("lancamentos");

  // lançamentos
  const [lancs, setLancs] = useState<
    Array<{
      id: number;
      tipo_recebimento: string;
      sentido: Sentido;
      valor: number;
      data_lancamento: string;
      bom_para?: string | null;
      numero_referencia?: string | null;
      observacao?: string | null;
      criado_por?: number | null;
      criado_por_nome?: string | null;
      status?: LancStatus; // mantido só para filtro
    }>
  >([]);
  const [lPage, setLPage] = useState(1);
  const [lLimit, setLLimit] = useState(25);
  const [fStatus, setFStatus] = useState<"" | LancStatus>("");
  const [fTipo, setFTipo] = useState<string>("");

  /** ▼▼ Parâmetros do pedido (dinâmicos) ▼▼ **/
  const [parametros, setParametros] = useState<ParametroItem[]>([]);
  const [paramSelecionadoId, setParamSelecionadoId] = useState<number | "">("");
  const paramSelecionado = useMemo(
    () => parametros.find((x) => x.id === paramSelecionadoId),
    [parametros, paramSelecionadoId]
  );
  const requerBomPara = !!paramSelecionado?.exige_bom_para;
  const requerTipoCheque = !!paramSelecionado?.exige_tipo_cheque;
  /** ▲▲ Parâmetros do pedido ▲▲ **/

  // campos do novo lançamento
  const [valor, setValor] = useState<string>("");
  const [dataLanc, setDataLanc] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [numRef, setNumRef] = useState("");
  const [obs, setObs] = useState("");
  const [savingLanc, setSavingLanc] = useState(false);

  // campos condicionais
  const [tipoCheque, setTipoCheque] = useState<"" | "PROPRIO" | "TERCEIRO">("");
  const [bomPara, setBomPara] = useState<string>("");

  const podeFechar = useMemo(() => b?.status === "ABERTO", [b?.status]);
  const podeEditar = podeFechar;

  // helpers de moeda
  function formatarMoedaBRL(input: string) {
    const onlyDigits = input.replace(/\D/g, "");
    if (!onlyDigits) return "";
    const asNumber = Number(onlyDigits) / 100;
    return asNumber.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function toNumber(brl: string) {
    return Number(brl.replace(/\./g, "").replace(",", "."));
  }

  // loaders
  async function load() {
    const [det, s] = await Promise.all([getBloco(blocoId), getSaldos(blocoId)]);
    setB(det);
    setSaldo(Number(s?.saldo ?? 0));
    setAReceber(Number(s?.a_receber ?? 0));
  }

  async function loadLancs() {
    const r = await listarLancamentos(blocoId, {
      page: lPage,
      limit: lLimit,
      status: (fStatus || undefined) as any,
      tipo: fTipo || undefined,
    });
    setLancs(r?.data ?? []);

    // atualiza cartões de saldo (novo endpoint)
    try {
      const s = await getSaldos(blocoId);
      setSaldo(Number(s?.saldo ?? 0));
      setAReceber(Number(s?.a_receber ?? 0));
    } catch {
      // fallback p/ compat: tenta saldo legado
      const s2 = await getSaldo(blocoId);
      setSaldo(Number(s2?.saldo ?? 0));
    }
  }

  useEffect(() => {
    if (!Number.isFinite(blocoId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!Number.isFinite(blocoId)) return;
    loadLancs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lPage, lLimit, fStatus, fTipo]);

  // carrega PARÂMETROS ativos
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/pedido-parametros", { params: { ativo: "true" } });
        const rows: ParametroItem[] = (data?.data ?? data ?? []).map((r: any) => ({
          id: Number(r.id),
          descricao: String(r.descricao ?? r.nome ?? r.chave ?? "").toUpperCase().trim(),
          tipo: String(r.tipo ?? "ENTRADA").toUpperCase() === "SAIDA" ? "SAIDA" : "ENTRADA",
          ativo: !!r.ativo,
          exige_bom_para: !!r.exige_bom_para,
          exige_tipo_cheque: !!r.exige_tipo_cheque,
        }));
        const ativos = rows.filter((x) => x.ativo);
        setParametros(ativos);
        setParamSelecionadoId((prev) => (prev === "" && ativos[0]?.id ? ativos[0].id : prev));
      } catch {
        setParametros([]);
        setParamSelecionadoId("");
      }
    })();
  }, []);

  // ações
  async function doAddLanc() {
    if (paramSelecionadoId === "") return alert("Selecione o tipo do lançamento.");
    if (!valor.trim()) return alert("Informe o valor.");

    const param = parametros.find((p) => p.id === paramSelecionadoId);
    if (!param) return alert("Parâmetro inválido.");

    // validações conforme flags do parâmetro
    if (requerTipoCheque && !tipoCheque) return alert("Selecione o tipo de cheque (PRÓPRIO/TERCEIRO).");
    if (requerBomPara && !bomPara) return alert("Informe a data 'Bom para'.");

    setSavingLanc(true);
    try {
      const payload: any = {
        tipo_recebimento: param.descricao,       // descrição do parâmetro
        sentido: param.tipo as Sentido,          // ENTADA/SAIDA do parâmetro
        valor: toNumber(valor),
        data_lancamento: dataLanc,
        numero_referencia: numRef || undefined,
        observacao: obs || undefined,
      };

      if (requerTipoCheque) payload.tipo_cheque = tipoCheque;
      if (requerBomPara)     payload.bom_para   = bomPara;

      await adicionarLancamento(blocoId, payload);

      // limpa campos
      setValor("");
      setNumRef("");
      setObs("");
      setBomPara("");
      setTipoCheque("");

      await loadLancs();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao adicionar lançamento.");
    } finally {
      setSavingLanc(false);
    }
  }

  async function doDel(lancId: number, temBomPara: boolean) {
    if (!podeEditar) return;
    if (temBomPara) {
      return alert("Este lançamento possui 'bom para' (A Receber). Exclua/ajuste o título correspondente antes.");
    }
    const ok = confirm("Excluir este lançamento? Esta ação não pode ser desfeita.");
    if (!ok) return;
    try {
      await excluirLancamento(blocoId, lancId);
      await loadLancs();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao excluir lançamento.");
    }
  }

  async function doFechar() {
    if (!podeFechar) return;
    if (saldo > 0) {
      const ok = confirm(
        `Fechar com saldo POSITIVO de ${saldo.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}?\n\nO crédito será considerado no próximo bloco do cliente.`
      );
      if (!ok) return;
    } else if (saldo < 0) {
      const ok = confirm(
        `Fechar com saldo NEGATIVO de ${saldo.toLocaleString("pt-BR",{style:"currency","currency":"BRL"})}?\n\nVocê confirmou que pode fechar mesmo com saldo devedor.`
      );
      if (!ok) return;
    }
    try {
      await fecharBloco(blocoId);
      await load();
      await loadLancs();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Falha ao fechar bloco.");
    }
  }

  const saldoTone =
    saldo < 0
      ? "from-red-50 to-rose-50 text-red-700"
      : saldo > 0
      ? "from-emerald-50 to-teal-50 text-emerald-700"
      : "from-slate-50 to-slate-50 text-slate-800";

  // classe do select (realça conforme o tipo escolhido)
  const selectTone =
    paramSelecionado?.tipo === "ENTRADA"
      ? "focus:ring-2 ring-red-300"
      : paramSelecionado?.tipo === "SAIDA"
      ? "focus:ring-2 ring-emerald-300"
      : "focus:ring-2 ring-slate-300";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="px-3 py-2 rounded-lg border hover:bg-slate-50">← Voltar</button>
          <h1 className="text-xl font-semibold">{b?.cliente_nome ?? `Cliente #${b?.cliente_id}`}</h1>
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
        <button
          onClick={doFechar}
          disabled={!podeFechar}
          className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          title={podeFechar ? "" : "Bloco já fechado"}
        >
          Fechar bloco
        </button>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border bg-white shadow-sm overflow-hidden">
        {(["lancamentos", "resumo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "px-4 py-2 text-sm " +
              (tab === t ? "bg-slate-900 text-white" : "hover:bg-slate-50")
            }
          >
            {t === "lancamentos" ? "Lançamentos" : "Resumo"}
          </button>
        ))}
      </div>

      {/* Saldos */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className={`rounded-2xl border bg-gradient-to-r ${saldoTone} p-4`}>
          <div className="text-xs opacity-70">Saldo</div>
          <div className="text-2xl font-semibold">
            {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[11px] opacity-70 mt-1">
            Considere apenas lançamentos imediatos (ignora lançamentos com “bom para”).
          </div>
        </div>

        <div className="rounded-2xl border bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-900 p-4">
          <div className="text-xs opacity-70">A receber</div>
          <div className="text-2xl font-semibold">
            {aReceber.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[11px] opacity-70 mt-1">
            Títulos do bloco em ABERTO/PARCIAL no Contas a Receber.
          </div>
        </div>
      </div>

      {/* conteúdo */}
      {tab === "lancamentos" && (
        <div className="space-y-4">
          {/* filtros */}
          <div className="rounded-2xl border bg-white p-3 shadow-sm flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm text-slate-700">Status</label>
              <select
                className="mt-1 border rounded-xl px-3 py-2"
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
              <label className="text-sm text-slate-700">Tipo</label>
              <select
                className="mt-1 border rounded-xl px-3 py-2"
                value={fTipo}
                onChange={(e) => setFTipo(e.target.value)}
              >
                <option value="">(todos)</option>
                {parametros.map((p) => {
                  const prefix = p.tipo === "ENTRADA" ? "🔴 ENTRADA" : "🟢 SAÍDA";
                  return (
                    <option key={p.id} value={p.descricao}>
                      {`${prefix} - ${p.descricao}`}
                    </option>
                  );
                })}
              </select>
            </div>
            <button className="px-3 py-2 rounded-xl border hover:bg-slate-50" onClick={loadLancs}>
              Atualizar
            </button>
          </div>

          {/* form */}
          <div className={"rounded-2xl border bg-white p-4 shadow-sm relative"}>
            {!podeEditar && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-2xl grid place-items-center text-slate-600">
                Bloco fechado — edição desabilitada
              </div>
            )}
            <div className="grid md:grid-cols-6 gap-3">
              <div className="md:col-span-3">
                <label className="text-sm text-slate-700">Tipo</label>
                <div className="flex items-center gap-2">
                  <select
                    className={["mt-1 border rounded-xl px-3 py-2 w-full", selectTone].join(" ")}
                    value={paramSelecionadoId}
                    onChange={(e) => setParamSelecionadoId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!podeEditar}
                  >
                    {parametros.map((p) => {
                      const prefix = p.tipo === "ENTRADA" ? "🔴 ENTRADA" : "🟢 SAÍDA";
                      return (
                        <option key={p.id} value={p.id}>
                          {`${prefix} - ${p.descricao}`}
                        </option>
                      );
                    })}
                  </select>

                  {paramSelecionado && (
                    <span
                      className={[
                        "text-[11px] whitespace-nowrap mt-1 rounded-full px-2 py-1 font-medium ring-1",
                        paramSelecionado.tipo === "ENTRADA"
                          ? "bg-red-50 text-red-700 ring-red-200"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                      ].join(" ")}
                      title={paramSelecionado.tipo}
                    >
                      {paramSelecionado.tipo}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-700">Valor</label>
                <input
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={valor}
                  onChange={(e) => setValor(formatarMoedaBRL(e.target.value))}
                  placeholder="0,00"
                  disabled={!podeEditar}
                />
              </div>

              <div>
                <label className="text-sm text-slate-700">Data</label>
                <input
                  type="date"
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={dataLanc}
                  onChange={(e) => setDataLanc(e.target.value)}
                  disabled={!podeEditar}
                />
              </div>

              {/* Campos condicionais de acordo com o parâmetro */}
              {requerTipoCheque && (
                <div>
                  <label className="text-sm text-slate-700">Tipo de cheque</label>
                  <select
                    className="mt-1 border rounded-xl px-3 py-2 w-full"
                    value={tipoCheque}
                    onChange={(e) => setTipoCheque((e.target.value as "PROPRIO" | "TERCEIRO") || "")}
                    disabled={!podeEditar}
                  >
                    <option value="">(selecione)</option>
                    <option value="PROPRIO">PRÓPRIO</option>
                    <option value="TERCEIRO">TERCEIRO</option>
                  </select>
                </div>
              )}

              {requerBomPara && (
                <div>
                  <label className="text-sm text-slate-700">Bom para</label>
                  <input
                    type="date"
                    className="mt-1 border rounded-xl px-3 py-2 w-full"
                    value={bomPara}
                    onChange={(e) => setBomPara(e.target.value)}
                    disabled={!podeEditar}
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-sm text-slate-700">Ref.</label>
                <input
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={numRef}
                  onChange={(e) => setNumRef(e.target.value)}
                  placeholder="nº do pedido / nº cheque / obs curta"
                  disabled={!podeEditar}
                />
              </div>

              <div className="md:col-span-4">
                <label className="text-sm text-slate-700">Observação</label>
                <input
                  className="mt-1 border rounded-xl px-3 py-2 w-full"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  disabled={!podeEditar}
                />
              </div>

              <div className="md:col-span-6">
                <button
                  onClick={doAddLanc}
                  disabled={savingLanc || !podeEditar}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingLanc ? "Salvando..." : "Adicionar lançamento"}
                </button>
              </div>
            </div>
          </div>

          {/* tabela */}
          <div className="rounded-2xl border bg-white overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/90 backdrop-blur border-b sticky top-0">
                <tr>
                  <th className="p-2 border">Tipo</th>
                  <th className="p-2 border">Sentido</th>
                  <th className="p-2 border">Valor</th>
                  <th className="p-2 border">Data</th>
                  <th className="p-2 border">Bom para</th>
                  <th className="p-2 border">Ref</th>
                  <th className="p-2 border">Por</th>
                  <th className="p-2 border">Obs</th>
                  <th className="p-2 border">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lancs.map((l) => {
                  const isReceber = !!l.bom_para;
                  const baseTone =
                    isReceber
                      ? "bg-amber-50/60"               // “A receber”
                      : l.sentido === "ENTRADA"
                        ? "bg-red-50/60"
                        : "bg-emerald-50/60";

                  return (
                    <tr key={l.id} className={baseTone}>
                      <td className="p-2 border">{l.tipo_recebimento}</td>
                      <td className="p-2 border">{l.sentido}</td>
                      <td className="p-2 border">
                        {Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="p-2 border">{dateBR(l.data_lancamento)}</td>
                      <td className="p-2 border">{dateBR(l.bom_para)}</td>
                      <td className="p-2 border">{l.numero_referencia ?? "-"}</td>
                      <td className="p-2 border">
                        {l.criado_por_nome?.trim() || (l.criado_por ? `#${l.criado_por}` : "-")}
                      </td>
                      <td className="p-2 border">{l.observacao ?? "-"}</td>
                      <td className="p-2 border">
                        <button
                          className="px-2 py-1 rounded-lg border text-xs hover:bg-slate-50 disabled:opacity-50"
                          disabled={!podeEditar || !!l.bom_para}
                          onClick={() => doDel(l.id, !!l.bom_para)}
                          title={l.bom_para ? "Exclua/ajuste primeiro o título gerado" : "Excluir lançamento"}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lancs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-5 text-center text-slate-500">
                      Nenhum lançamento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded-xl border hover:bg-slate-50" onClick={() => setLPage((p) => Math.max(1, p - 1))}>
              ◀
            </button>
            <span className="text-sm">Página {lPage}</span>
            <button className="px-2 py-1 rounded-xl border hover:bg-slate-50" onClick={() => setLPage((p) => p + 1)}>
              ▶
            </button>
            <select className="ml-3 border rounded-xl px-2 py-1" value={lLimit} onChange={(e) => setLLimit(Number(e.target.value))}>
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}/pág</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {tab === "resumo" && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">Cliente</div>
              <div className="font-medium">{b?.cliente_nome ?? b?.cliente_id}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Aberto em</div>
              <div className="font-medium">{dateTimeBR(b?.aberto_em as any)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Fechado em</div>
              <div className="font-medium">{dateTimeBR(b?.fechado_em as any)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
