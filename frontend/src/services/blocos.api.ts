// src/services/blocos.api.ts
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

/* ------------ Blocos ------------ */
export async function listarBlocos(params: {
  page?: number;
  limit?: number;
  status?: BlocoStatus;
  cliente_id?: number;
  cliente?: string;   // busca por nome
  search?: string;    // por código
}) {
  const { data } = await api.get("/blocos", { params });
  // normaliza o payload vindo da API
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
export async function getSaldo(blocoId: number) {
  const { data } = await api.get(`/blocos/${blocoId}/saldo`);
  return data;
}

export async function getSaldos(blocoId: number) {
  const { data } = await api.get(`/blocos/${blocoId}/saldos`);
  return data as { bloco_id: number; saldo: number; a_receber: number };
}
