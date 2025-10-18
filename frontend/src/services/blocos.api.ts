import api from "./api";

/* ------------ Types ------------ */
export type BlocoStatus = "ABERTO" | "FECHADO";

export type Bloco = {
  id: number;
  codigo: string;
  status: BlocoStatus;
  cliente_id: number;
  cliente_nome?: string | null;
  aberto_em?: string | null;
  fechado_em?: string | null;
  observacao?: string | null;
};

export type SaldosResponse = {
  bloco_id: number;
  saldo_bloco: number;     // todas as movimentações (ENTRADA− / SAÍDA+)
  saldo_imediato: number;  // imediato (ignora bom_para)
  a_receber: number;       // títulos ABERTO/PARCIAL
  saldo_financeiro: number;// imediato + baixados
};

/* ------------ Blocos ------------ */
export async function listarBlocos(params: {
  page?: number;
  limit?: number;
  status?: BlocoStatus;
  cliente_id?: number;
  cliente?: string;
  search?: string;
}) {
  const { data } = await api.get("/blocos", { params });
  const payload = data?.data ? data : { data };
  return {
    data: (payload.data ?? []) as Bloco[],
    page: Number(payload.page ?? params.page ?? 1),
    limit: Number(payload.limit ?? params.limit ?? 10),
    total: Number(payload.total ?? (payload.data?.length ?? 0)),
  };
}

export async function getBloco(id: number) {
  const { data } = await api.get(`/blocos/${id}`);
  return data as Bloco;
}

export async function fecharBloco(id: number) {
  const { data } = await api.post(`/blocos/${id}/fechar`);
  return data;
}

/* ------------ Lançamentos ------------ */
export async function listarLancamentos(
  blocoId: number,
  params: { page?: number; limit?: number; status?: string; tipo?: string }
) {
  const { data } = await api.get(`/blocos/${blocoId}/lancamentos`, { params });
  return data as { data: any[]; page: number; limit: number; total: number };
}

export async function adicionarLancamento(blocoId: number, payload: any) {
  const { data } = await api.post(`/blocos/${blocoId}/lancamentos`, payload);
  return data;
}

export async function excluirLancamento(blocoId: number, lancId: number) {
  const { data } = await api.delete(`/blocos/${blocoId}/lancamentos/${lancId}`);
  return data;
}

/* ------------ Saldos ------------ */
export async function getSaldos(blocoId: number) {
  const { data } = await api.get(`/blocos/${blocoId}/saldos`);
  return data as SaldosResponse;
}
