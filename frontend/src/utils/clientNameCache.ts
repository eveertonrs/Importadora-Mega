// src/utils/clientNameCache.ts
import api from "../services/api";

const cache = new Map<number, string>();

export async function ensureClientNames(ids: number[]) {
  const need = ids.filter((id) => id && !cache.has(id));
  if (need.length === 0) return;

  // tenta endpoint em lote: /clientes?ids=1,2,3
  try {
    const { data } = await api.get("/clientes", {
      params: { ids: need.join(",") },
      headers: { "x-silent": "1" },
    });
    const list = (data?.data ?? data ?? []) as { id: number; nome_fantasia?: string }[];
    list.forEach((c) => cache.set(Number(c.id), c.nome_fantasia || `#${c.id}`));
    // se ainda faltou alguém, cai no fallback
    const resolved = new Set(list.map((c) => Number(c.id)));
    const missing = need.filter((id) => !resolved.has(id));
    await Promise.all(
      missing.map(async (id) => {
        try {
          const { data } = await api.get(`/clientes/${id}`, { headers: { "x-silent": "1" } });
          cache.set(Number(id), data?.nome_fantasia || `#${id}`);
        } catch {
          cache.set(Number(id), `#${id}`);
        }
      })
    );
  } catch {
    // sem endpoint em lote? busca 1 a 1
    await Promise.all(
      need.map(async (id) => {
        try {
          const { data } = await api.get(`/clientes/${id}`, { headers: { "x-silent": "1" } });
          cache.set(Number(id), data?.nome_fantasia || `#${id}`);
        } catch {
          cache.set(Number(id), `#${id}`);
        }
      })
    );
  }
}

export function getClientName(id?: number | null, fallback?: string | null) {
  if (!id) return fallback ?? "—";
  return cache.get(Number(id)) || fallback || `#${id}`;
}
