// src/components/ui/StatusBadge.tsx
import React from "react";

const colors: Record<string, string> = {
  ABERTO: "bg-red-100 text-red-700",
  PARCIAL: "bg-amber-100 text-amber-700",
  BAIXADO: "bg-emerald-100 text-emerald-700",
  DEVOLVIDO: "bg-gray-200 text-gray-700",
  CANCELADO: "bg-gray-200 text-gray-700",
};

export default function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[value] ?? "bg-slate-100 text-slate-700"}`}>
      {value}
    </span>
  );
}
