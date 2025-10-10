import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export type Permissao = "admin" | "administrador" | "financeiro" | "vendedor";

export interface AuthenticatedUser {
  id: number;
  nome: string;
  permissao: Permissao;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization;
  if (!bearer || !bearer.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Acesso não autorizado" });
  }

  const token = bearer.slice(7);
  try {
    const secret = process.env.JWT_SECRET as string;
    if (!secret) {
      return res.status(500).json({ message: "Configuração inválida do servidor (JWT_SECRET)" });
    }

    const decoded = jwt.verify(token, secret) as JwtPayload & {
      id: number;
      nome: string;
      permissao: string;
    };

    const permissao = (decoded.permissao || "vendedor").toLowerCase() as Permissao;

    req.user = {
      id: decoded.id,
      nome: decoded.nome,
      permissao,
    };

    next();
  } catch (error) {
    console.error("Erro de autenticação:", error);
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
};

/**
 * authorize() - middleware de permissão
 * Aceita múltiplos papéis (ex: authorize("admin", "financeiro"))
 * Diferencia 401 (sem token) e 403 (sem permissão).
 */
export const authorize =
  (...roles: Permissao[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Acesso não autorizado" });

    // Se nenhum papel foi especificado → qualquer usuário autenticado passa
    if (roles.length === 0) return next();

    const userRole = req.user.permissao.toLowerCase();
    const allowed = roles.map((r) => r.toLowerCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ message: "Você não tem permissão para esta ação" });
    }

    next();
  };
