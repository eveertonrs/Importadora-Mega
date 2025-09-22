// src/services/blocos.api.ts
import api from "./api";

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

export async function listarBlocos(params: {
  page?: number;
  limit?: number;
  status?: BlocoStatus;
  cliente?: string; // nome_fantasia contém
  search?: string;  // código
}) {
  const { data } = await api.get("/blocos", { params });
  return data; // {data, page, limit, total}
}

export async function getBloco(id: number) {
  const { data } = await api.get(`/blocos/${id}`);
  return data as Bloco;
}

export async function criarBloco(payload: {
  cliente_id: number;
  codigo?: string;
  observacao?: string;
}) {
  const { data } = await api.post("/blocos", payload);
  return data as Bloco;
}

export async function listarPedidosDoBloco(blocoId: number, params?: { page?: number; limit?: number }) {
  const { data } = await api.get(`/blocos/${blocoId}/pedidos`, { params });
  return data; // {data, page, limit, total}
}

export async function vincularPedido(blocoId: number, payload: { pedido_id: number; valor_pedido?: number }) {
  const { data } = await api.post(`/blocos/${blocoId}/pedidos`, payload);
  return data;
}

export async function desvincularPedido(blocoId: number, pedidoId: number) {
  const { data } = await api.delete(`/blocos/${blocoId}/pedidos/${pedidoId}`);
  return data;
}

export  type LancStatus = "PENDENTE" | "LIQUIDADO" | "DEVOLVIDO" | "CANCELADO";
export type TipoReceb =
  | "CHEQUE"
  | "DINHEIRO"
  | "BOLETO"
  | "DEPOSITO"
  | "PIX"
  | "TROCA"
  | "BONIFICACAO"
  | "DESCONTO A VISTA"
  | "DEVOLUCAO"
  | "PEDIDO";

export async function listarLancamentos(blocoId: number, params?: {
  page?: number;
  limit?: number;
  status?: LancStatus;
  tipo?: TipoReceb;
}) {
  const { data } = await api.get(`/blocos/${blocoId}/lancamentos`, { params });
  return data; // {data, page, limit, total}
}

export async function adicionarLancamento(blocoId: number, payload: {
  tipo_recebimento: TipoReceb;
  valor: number;
  data_lancamento: string; // ISO date/time (yyyy-mm-dd or yyyy-mm-ddThh:mm)
  bom_para?: string;        // required for CHEQUE
  tipo_cheque?: "PROPRIO" | "TERCEIRO"; // required for CHEQUE
  numero_referencia?: string;
  status?: LancStatus; // default PENDENTE
  observacao?: string;
}) {
  const { data } = await api.post(`/blocos/${blocoId}/lancamentos`, payload);
  return data;
}

export async function getSaldo(blocoId: number) {
  const { data } = await api.get(`/blocos/${blocoId}/saldo`);
  return data as { bloco_id: number; saldo: number };
}

export async function fecharBloco(blocoId: number) {
  const { data } = await api.post(`/blocos/${blocoId}/fechar`, {});
  return data as Bloco;
}
