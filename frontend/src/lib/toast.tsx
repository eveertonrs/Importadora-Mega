// src/lib/toast.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastBase = {
  type: "success" | "error" | "info";
  message: string;
  /** tempo em ms (default 3500) */
  duration?: number;
};

type Toast = ToastBase & { id: number };

type Ctx = {
  show: (t: ToastBase) => void;
  /** atalhos semântico-opcionais */
  success: (message: string, opts?: Omit<ToastBase, "type" | "message">) => void;
  error: (message: string, opts?: Omit<ToastBase, "type" | "message">) => void;
  info: (message: string, opts?: Omit<ToastBase, "type" | "message">) => void;
  /** fecha manualmente (ex.: após retry) */
  dismiss: (id: number) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToasterProvider({
  children,
  maxQueue = 5,
  defaultDuration = 3500,
}: {
  children: React.ReactNode;
  /** máximo de toasts simultâneos */
  maxQueue?: number;
  /** duração padrão em ms */
  defaultDuration?: number;
}) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef<Record<number, number>>({}); // ids de setTimeout

  // teclado: ESC fecha o último
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setItems((prev) => {
          const last = prev.at(-1);
          if (!last) return prev;
          clearTimeout(timers.current[last.id]);
          const next = prev.slice(0, -1);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dismiss = (id: number) => {
    clearTimeout(timers.current[id]);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const push = (t: ToastBase) => {
    const id = Date.now() + Math.random();
    const toast: Toast = { id, ...t, duration: t.duration ?? defaultDuration };

    setItems((prev) => {
      const next = [...prev, toast];
      // corta a fila no início se exceder o limite
      return next.length > maxQueue ? next.slice(next.length - maxQueue) : next;
    });

    timers.current[id] = window.setTimeout(() => {
      dismiss(id);
    }, toast.duration);
  };

  const value = useMemo<Ctx>(
    () => ({
      show: push,
      success: (message, opts) => push({ type: "success", message, ...opts }),
      error: (message, opts) => push({ type: "error", message, ...opts }),
      info: (message, opts) => push({ type: "info", message, ...opts }),
      dismiss,
    }),
    []
  );

  // limpa timers ao desmontar
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, []);

  return (
    <ToastCtx.Provider value={value}>
      {children}

      {/* container */}
      <div
        className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2"
        aria-live="polite"
        role="status"
      >
        {items.map((i) => (
          <ToastItem key={i.id} toast={i} onClose={() => dismiss(i.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const colors =
    toast.type === "success"
      ? "bg-emerald-600 ring-emerald-700"
      : toast.type === "error"
      ? "bg-red-600 ring-red-700"
      : "bg-slate-800 ring-slate-900";

  return (
    <div
      className={[
        "pointer-events-auto rounded-md px-4 py-3 text-white shadow-lg ring-1",
        "animate-[toast-in_180ms_ease-out] will-change-transform",
        colors,
      ].join(" ")}
      style={{
        // keyframe simples via inline para evitar dependência
        // @ts-ignore
        "--tw-animate": "translateY(-6px) scale(0.98)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-sm leading-5">{toast.message}</span>
        <button
          className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white/90 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
          onClick={onClose}
          aria-label="Fechar notificação"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToasterProvider>");
  return ctx;
}
