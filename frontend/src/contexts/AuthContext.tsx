// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import axios from "axios";

type Permissao = "admin" | "financeiro" | "vendedor";

interface User {
  id: number;
  nome: string;
  email: string;
  permissao: Permissao | string; // mantém compatibilidade com respostas anteriores
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  logout: () => void;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // tenta refresh se houver token expirado no boot
  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");

      if (!token || !userData) {
        logout(true);
        return;
      }

      try {
        const parsedUser = JSON.parse(userData) as User;
        // tenta refresh se expirado
        if (isTokenExpired(token)) {
          try {
            const resp = await axios.post(
              `${API_URL}/auth/refresh`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const newToken = resp.data?.token as string | undefined;
            if (!newToken) throw new Error("Refresh sem token");
            localStorage.setItem("token", newToken);
            setUser(parsedUser);
            setIsAuthenticated(true);
          } catch {
            logout(true);
            return;
          }
        } else {
          setUser(parsedUser);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Falha ao ler user do localStorage:", err);
        logout(true);
      }
    };

    bootstrap();
    // opcional: renovar token um pouco antes de expirar (ex.: a cada 5 min checa)
    const interval = setInterval(async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      // se faltam menos de 2 minutos para expirar, tenta refresh
      try {
        const payloadBase64 = token.split(".")[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);
        const exp = payload.exp as number | undefined;
        if (!exp) return;
        const now = Math.floor(Date.now() / 1000);
        const secondsLeft = exp - now;
        if (secondsLeft <= 120) {
          const resp = await axios.post(
            `${API_URL}/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const newToken = resp.data?.token as string | undefined;
          if (newToken) localStorage.setItem("token", newToken);
        }
      } catch {
        // se der erro silencioso aqui, não desloga; o fluxo normal lida no próximo request
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const logout = (silent = false) => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
    if (!silent) {
      // opcional: feedback ou redirect pode ser feito fora deste contexto
      console.info("Sessão finalizada.");
    }
  };

  const value = {
    isAuthenticated,
    user,
    logout,
    setIsAuthenticated,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
