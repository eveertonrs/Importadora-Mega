// frontend/src/services/blocos.api.ts
import api from "./api";

export type BlocoStatus = "ABERTO" | "FECHADO";

export type Bloco = {
  id: number;
  codigo: string;
  status: BlocoStatus;
  cliente_id: number;
  cliente_nome?: string;
  aberto_em?: string;
  fechado_em?: string | null;
  observacao?: string | null;
};

export type VinculoPedidoDTO = {
  id: number;
  bloco_id: number;
  pedido_id: number;
  cliente_id?: number;
  valor_total?: number;
  data_pedido?: string;
  criado_em?: string;
  criado_por?: number | null;
};

export type LancamentoDTO = {
  id: number;
  bloco_id: number;
  tipo_recebimento: string;
  sentido: "ENTRADA" | "SAIDA";
  valor: number;
  data_lancamento: string;
  bom_para?: string | null;
  tipo_cheque?: "PROPRIO" | "TERCEIRO" | null;
  numero_referencia?: string | null;
  status: "PENDENTE" | "LIQUIDADO" | "DEVOLVIDO" | "CANCELADO";
  observacao?: string | null;
  referencia_pedido_id?: number | null;
  referencia_lancamento_id?: number | null;
  criado_por?: number | null;
  criado_em?: string;
};

// ==== chamadas ====

export async function listarBlocos(params: {
  cliente_id?: number;
  status?: BlocoStatus;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get("/blocos", { params });
  return data as { data: Bloco[]; total: number; page: number; limit: number };
}

export async function obterBloco(id: number) {
  const { data } = await api.get(`/blocos/${id}`);
  return data as Bloco;
}

export async function listarPedidosDoBloco(
  id: number,
  params?: { page?: number; limit?: number }
) {
  const { data } = await api.get(`/blocos/${id}/pedidos`, { params });
  return data as { data: VinculoPedidoDTO[]; total: number; page: number; limit: number };
}

export async function listarLancamentosDoBloco(
  id: number,
  params?: { status?: string; tipo?: string; page?: number; limit?: number }
) {
  const { data } = await api.get(`/blocos/${id}/lancamentos`, { params });
  return data as { data: LancamentoDTO[]; total: number; page: number; limit: number };
}

export async function getSaldo(id: number) {
  const { data } = await api.get(`/blocos/${id}/saldo`);
  return data as { bloco_id: number; saldo: number };
}

export async function criarLancamento(
  id: number,
  payload: Omit<LancamentoDTO, "id" | "sentido" | "criado_em" | "bloco_id">
) {
  const { data } = await api.post(`/blocos/${id}/lancamentos`, payload);
  return data as LancamentoDTO;
}

export async function vincularPedido(
  id: number,
  payload: { pedido_id: number; valor_pedido?: number }
) {
  const { data } = await api.post(`/blocos/${id}/pedidos`, payload);
  return data as {
    message: string;
    data: VinculoPedidoDTO;
    lancamento_gerado: boolean;
  };
}

export async function desvincularPedido(id: number, pedidoId: number) {
  const { data } = await api.delete(`/blocos/${id}/pedidos/${pedidoId}`);
  return data as { message: string };
}

export async function fecharBlocoApi(id: number) {
  const { data } = await api.post(`/blocos/${id}/fechar`);
  return data as Bloco;
}
