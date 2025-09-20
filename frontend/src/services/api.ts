// src/services/api.ts
import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

// ===== Notificação (ligada no App/Main via bindNotifier) =====
export let notify: (type: "success" | "error" | "info", message: string) => void = () => {};
export const bindNotifier = (fn: typeof notify) => {
  notify = fn || (() => {});
};

// ===== Config extra por requisição (ex.: silenciar toasts) =====
type ExtraFlags = {
  /** não mostrar toast em erros dessa request */
  silent?: boolean;
};

// Vamos ler flags via cast interno para não quebrar a tipagem dos interceptors
type AnyConfig = InternalAxiosRequestConfig & { _flags?: ExtraFlags };

// ===== Instância =====
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "https://x3nbflkg-3333.brs.devtunnels.ms",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// (opcional) utilitários p/ auth
export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem("token", token);
    // em axios v1, defaults.headers.common é AxiosHeaders; string direta funciona
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
  }
};

// ===== Interceptors =====
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("token");
  if (token) {
    // Em axios v1, config.headers é AxiosHeaders; preferir .set quando existir
    const h = config.headers as any;
    if (h?.set) {
      h.set("Authorization", `Bearer ${token}`);
    } else {
      // fallback para objeto literal
      config.headers = {
        ...(config.headers as any),
        Authorization: `Bearer ${token}`,
      } as any;
    }
  }
  return config;
});

// helper interno
const shouldSilence = (cfg?: AnyConfig) => Boolean(cfg?._flags?.silent);

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<any, any>) => {
    const cfg = err.config as AnyConfig | undefined;

    const msg =
      (err.response?.data as any)?.message ??
      err.message ??
      "Falha ao comunicar com o servidor";

    if (err.response?.status === 401) {
      setAuthToken(null);
      if (!shouldSilence(cfg)) notify("error", "Sessão expirada. Faça login novamente.");
      if (!/\/login$/.test(window.location.pathname)) {
        setTimeout(() => (window.location.href = "/login"), 50);
      }
    } else {
      if (!shouldSilence(cfg)) notify("error", msg);
    }

    return Promise.reject(err);
  }
);

export default api;

// ===== Tipos auxiliares para uso externo (opcional) =====
export type RequestFlags = { _flags?: ExtraFlags };
export type ApiConfig = AxiosRequestConfig & RequestFlags;
