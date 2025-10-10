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

export type ConferenciaResult = {
  data: string;
  total: number;
  resumo: Record<string, number>;
  titulos: Titulo[];
};

export async function conferenciaDiaria(params: {
  data?: string;          // "YYYY-MM-DD"
  operador_id?: number;
  cliente_id?: number;
}) {
  const { data } = await api.get("/financeiro/conferencia", { params });
  return data as ConferenciaResult;
}
