// src/contexts/AuthContext.tsx
import React, {
  createContext, useState, useContext, useEffect, useRef, type ReactNode
} from "react";
import api from "../services/api";

type Permissao = "admin" | "financeiro" | "vendedor";

interface User {
  id: number;
  nome: string;
  email: string;
  permissao: Permissao | string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loadingAuth: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Guard para evitar bootstrap duplicado no StrictMode (apenas DEV)
let didBootstrap = false;

function isTokenExpired(token: string): boolean {
  try {
    const payloadBase64 = token.split(".")[1];
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);
    const exp = payload.exp as number | undefined;
    if (!exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return exp <= now;
  } catch {
    return true;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // executa 1x mesmo com StrictMode no DEV
  useEffect(() => {
    const bootstrap = async () => {
      if (import.meta.env.DEV && didBootstrap) {
        // evita repetir no StrictMode (monta/desmonta)
        setLoadingAuth(false);
        return;
      }
      didBootstrap = true;

      const token = localStorage.getItem("token");
      const rawUser = localStorage.getItem("user");

      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;

      if (!token || !rawUser) {
        // sem sessão
        setUser(null);
        setIsAuthenticated(false);
        setLoadingAuth(false);
        return;
      }

      try {
        const parsed = JSON.parse(rawUser) as User;

        // se estiver expirado, apenas limpa sessão
        // (você pode implementar /auth/refresh depois)
        if (isTokenExpired(token)) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          delete api.defaults.headers.common.Authorization;
          setUser(null);
          setIsAuthenticated(false);
          setLoadingAuth(false);
          return;
        }

        setUser(parsed);
        setIsAuthenticated(true);
      } catch {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoadingAuth(false);
      }
    };

    bootstrap();
  }, []);

  const login = (token: string, u: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    setUser(u);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete api.defaults.headers.common.Authorization;
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, loadingAuth, login, logout, setUser, setIsAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
