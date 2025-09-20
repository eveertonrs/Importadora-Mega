// src/components/ProtectedRoute.tsx
import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Props = {
  children: ReactElement;
  /** opcional: restringe por permissão do usuário */
  requiredRoles?: Array<"admin" | "financeiro" | "vendedor">;
};

export default function ProtectedRoute({ children, requiredRoles }: Props) {
  const location = useLocation();
  const { isAuthenticated, loadingAuth, user } = useAuth();

  // Enquanto valida token/estado:
  if (loadingAuth) {
    return (
      <div className="p-6 text-sm text-slate-600">Carregando…</div>
    );
  }

  // Se não autenticado, manda para login e guarda a rota de origem
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  // Se houver restrição de papel e o usuário não tiver -> manda para home
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = requiredRoles.includes(user?.permissao as any);
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
