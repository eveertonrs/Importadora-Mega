import axios from "axios";

/** Tipos para o notificador (toast/alert) */
type Type = "success" | "error" | "info" | "warning";
type Notifier = (type: Type, message: string) => void;

let notifier: Notifier | null = null;

/** O App (via <NotifyBridge />) pluga aqui a função que mostra o toast */
export function bindNotifier(fn: Notifier) {
  notifier = fn;
}

/** Opcional: permitir disparar toasts de qualquer lugar do app */
export function notify(type: Type, message: string) {
  notifier?.(type, message);
}

/** Cliente axios base */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "https://x3nbflkg-3333.brs.devtunnels.ms",
  // withCredentials: true, // habilite se usar cookie/sessão
});

/** Token JWT (se existir) vai no header */
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

/** Intercepta erros e joga pro toast */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Erro inesperado";
    notifier?.("error", msg);
    return Promise.reject(err);
  }
);

export default api;
