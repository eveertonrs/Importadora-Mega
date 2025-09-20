// src/components/ui/button.tsx
import React from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean; // mantém compatibilidade se você já usava
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const variants: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
  secondary:
    "bg-slate-800 text-white hover:bg-slate-900 focus-visible:ring-slate-800",
  outline:
    "border border-slate-300 text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-300",
  ghost:
    "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export default function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
