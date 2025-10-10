import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** exibe estado de erro (borda/aria-invalid) */
  invalid?: boolean;
  /** tamanho visual do componente (não confundir com o atributo nativo size) */
  uiSize?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-9 text-sm px-3",
  md: "h-10 text-sm px-3",
  lg: "h-11 text-base px-4",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, uiSize = "md", type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "w-full rounded-md border bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200",
          invalid ? "border-red-300" : "border-slate-300",
          sizes[uiSize],
          className
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
export default Input;
