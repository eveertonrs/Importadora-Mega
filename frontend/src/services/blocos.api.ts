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
  cliente?: string;
  cliente_id?: number;
  search?: string;
}) {
  const { data } = await api.get("/blocos", { params });
  return data as { data: Bloco[]; page: number; limit: number; total: number };
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

export async function listarPedidosDoBloco(
  blocoId: number,
  params?: { page?: number; limit?: number }
) {
  const { data } = await api.get(`/blocos/${blocoId}/pedidos`, { params });
  return data as {
    data: Array<{
      id: number;
      bloco_id: number;
      pedido_id: number;
      cliente_id?: number;
      valor_total?: number;
      data_pedido?: string;
      numero_pedido_ext?: string | null;
      descricao?: string | null;
      criado_em?: string;
      criado_por?: number | null;
    }>;
    page: number;
    limit: number;
    total: number;
  };
}

/** aceita id numérico OU referência livre (string) */
export async function vincularPedido(
  blocoId: number,
  payload:
    | { pedido_id: number; valor_pedido?: number; descricao?: string }
    | { pedido_ref: string; valor_pedido?: number; descricao?: string }
) {
  const { data } = await api.post(`/blocos/${blocoId}/pedidos`, payload);
  return data as {
    message?: string;
    code?: "ALREADY_LINKED" | "FALLBACK_LANC";
    data?: { id: number; bloco_id: number; pedido_id: number; criado_em?: string } | null;
    lancamento_gerado: boolean;
    modo?: "ref_livre" | "fallback_sem_vinculo" | "vinculo";
  };
}

export async function desvincularPedido(blocoId: number, pedidoId: number) {
  const { data } = await api.delete(`/blocos/${blocoId}/pedidos/${pedidoId}`);
  return data as { message: string };
}

export type LancStatus = "PENDENTE" | "LIQUIDADO" | "DEVOLVIDO" | "CANCELADO";
export type Sentido = "ENTRADA" | "SAIDA";

export async function listarLancamentos(
  blocoId: number,
  params?: {
    page?: number;
    limit?: number;
    status?: LancStatus;
    tipo?: string;
  }
) {
  const { data } = await api.get(`/blocos/${blocoId}/lancamentos`, { params });
  return data as {
    data: Array<{
      id: number;
      bloco_id: number;
      tipo_recebimento: string;
      sentido: Sentido;
      valor: number;
      data_lancamento: string;
      bom_para?: string | null;
      tipo_cheque?: "PROPRIO" | "TERCEIRO" | null;
      numero_referencia?: string | null;
      status: LancStatus;
      observacao?: string | null;
      criado_por?: number | null;
      criado_em?: string;
      referencia_pedido_id?: number | null;
      referencia_lancamento_id?: number | null;
    }>;
    page: number;
    limit: number;
    total: number;
  };
}

export async function adicionarLancamento(
  blocoId: number,
  payload: {
    tipo_recebimento: string;
    sentido: Sentido; // ignorado pelo backend, usado só no front
    valor: number;
    data_lancamento: string;
    bom_para?: string;
    tipo_cheque?: "PROPRIO" | "TERCEIRO";
    numero_referencia?: string;
    status?: LancStatus;
    observacao?: string;
  }
) {
  const { data } = await api.post(`/blocos/${blocoId}/lancamentos`, payload);
  return data as any;
}

/** legado (mantido) */
export async function getSaldo(blocoId: number) {
  const { data } = await api.get(`/blocos/${blocoId}/saldo`);
  return data as { bloco_id: number; saldo: number };
}

/** novo: saldo + a receber */
export async function getSaldos(blocoId: number) {
  const { data } = await api.get(`/blocos/${blocoId}/saldos`);
  return data as { bloco_id: number; saldo: number; a_receber: number };
}

export async function fecharBloco(blocoId: number) {
  const { data } = await api.post(`/blocos/${blocoId}/fechar`, {});
  return data as Bloco & { saldo_no_fechamento?: number };
}
