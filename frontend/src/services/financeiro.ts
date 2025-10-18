// src/services/financeiro.ts
import api from "./api";

export type Titulo = {
  id: number;
  cliente_id: number;
  cliente_nome?: string;
  tipo: "CHEQUE" | "BOLETO" | "PIX" | "DEPOSITO" | string;
  numero_doc?: string | null;
  bom_para: string;             // ISO date
  valor_bruto: number;
  valor_baixado: number;
  status: "ABERTO" | "PARCIAL" | "BAIXADO" | "DEVOLVIDO" | "CANCELADO";
  observacao?: string | null;
  bloco_id?: number | null;
};

export async function listarTitulos(params: {
  status?: string;       // ex "ABERTO,PARCIAL"
  tipo?: string;         // "CHEQUE" | "BOLETO"
  from?: string;         // "YYYY-MM-DD"
  to?: string;           // "YYYY-MM-DD"
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get("/financeiro/titulos", { params });
  return data as { total: number; page: number; pageSize: number; data: Titulo[] };
}

export async function registrarBaixa(tituloId: number, payload: {
  valor_baixa: number;
  data_baixa?: string;   // ISO datetime
  forma_pagto?: string;
  obs?: string;
}) {
  const { data } = await api.post(`/financeiro/titulos/${tituloId}/baixas`, payload);
  return data;
}

export async function atualizarTitulo(id: number, patch: Partial<Titulo>) {
  const { data } = await api.patch(`/financeiro/titulos/${id}`, patch);
  return data;
}

/* ====================== Conferência ====================== */

export type OrigemConferencia = "BLOCO_LANC" | "TITULO" | "BAIXA";
export type StatusConferencia = "PENDENTE" | "CONFIRMADO" | "DIVERGENTE";

export type ConferenciaItem = {
  id: number;
  origem: OrigemConferencia;
  origem_id: number;
  data_evento: string; // yyyy-mm-dd

  cliente_id: number;
  cliente_nome?: string | null;

  tipo: string;
  numero_doc?: string | null;
  bom_para?: string | null;

  valor: number;
  valor_baixado?: number;

  status_negocio?: string;
  status_conferencia?: StatusConferencia;
  comentario?: string | null;

  bloco_id?: number | null;
  titulo_id?: number | null;
};

export type ConferenciaResult = {
  data: string;
  total: number;
  resumo: Record<string, number>;
  itens: ConferenciaItem[];
};

export async function conferenciaDiaria(params: {
  data?: string;          // "YYYY-MM-DD"
  operador_id?: number;
  cliente_id?: number;
}) {
  const { data } = await api.get("/financeiro/conferencia", { params });
  return data as ConferenciaResult;
}

type ConferenciaUpsertPayload = {
  data?: string;
  status: StatusConferencia;
  comentario?: string;
  itens: Array<{ origem: OrigemConferencia; origem_id: number }>;
};

export async function conferenciaAtualizar(payload: ConferenciaUpsertPayload) {
  const { data } = await api.patch("/financeiro/conferencia", payload);
  return data;
}

export async function conferenciaConfirmar(args: {
  data?: string;
  itens: Array<{ origem: OrigemConferencia; origem_id: number }>;
}) {
  return conferenciaAtualizar({ status: "CONFIRMADO", itens: args.itens, data: args.data });
}

export async function conferenciaDivergir(args: {
  data?: string;
  comentario: string;
  itens: Array<{ origem: OrigemConferencia; origem_id: number }>;
}) {
  return conferenciaAtualizar({ status: "DIVERGENTE", comentario: args.comentario, itens: args.itens, data: args.data });
}

export async function conferenciaDesfazer(args: {
  data?: string;
  itens: Array<{ origem: OrigemConferencia; origem_id: number }>;
}) {
  return conferenciaAtualizar({ status: "PENDENTE", itens: args.itens, data: args.data });
}
