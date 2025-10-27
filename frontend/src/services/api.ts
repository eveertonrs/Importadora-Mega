// src/services/api.ts
import axios from "axios";

export type Type = "success" | "error" | "info";
export type Notifier = (type: Type, message: string) => void;
let notifier: Notifier | null = null;

export function bindNotifier(fn: Notifier) { notifier = fn; }
export function notify(type: Type, message: string) { notifier?.(type, message); }

function resolveBase(): string {
  const baseEnv = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (baseEnv) return baseEnv.replace(/\/+$/, "");

  const urlEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (urlEnv) {
    const clean = urlEnv.replace(/\/+$/, "");
    return /\/api\/?$/.test(urlEnv) ? clean : `${clean}/api`;
  }
  return "/api";
}

const BASE = resolveBase();

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const silent =
      err?.config?.headers?.["x-silent"] === "1" ||
      err?.config?.meta?.silent === true;

    if (!silent) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        "Erro inesperado";
      notifier?.("error", msg);
    }
    return Promise.reject(err);
  }
);

export { api, BASE as API_BASE };
export default api;
