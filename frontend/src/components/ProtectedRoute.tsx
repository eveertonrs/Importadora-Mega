// src/components/ProtectedRoute.tsx
import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { Permissao } from "../contexts/AuthContext";

type Props = {
  children: ReactElement;
  /** opcional: restringe por permissão do usuário */
  requiredRoles?: Array<Permissao>;
};

export default function ProtectedRoute({ children, requiredRoles }: Props) {
  const location = useLocation();
  const { isAuthenticated, loadingAuth, user } = useAuth();

  if (loadingAuth) {
    return <div className="p-6 text-sm text-slate-600">Carregando…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = requiredRoles.includes((user?.permissao as Permissao) ?? "vendedor");
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
