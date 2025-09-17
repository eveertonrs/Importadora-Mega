import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export type Permissao = "admin" | "financeiro" | "vendedor";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    nome: string;
    permissao: Permissao;
  };
}

export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization;
  if (!bearer || !bearer.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Acesso não autorizado" });
  }

  const token = bearer.slice(7);
  try {
    const secret = process.env.JWT_SECRET as string;
    const decoded = jwt.verify(token, secret) as JwtPayload & {
      id: number;
      nome: string;
      permissao: string;
    };

    // Normaliza a role para minúsculas independentemente do que vier no token
    req.user = {
      id: decoded.id,
      nome: decoded.nome,
      permissao: (decoded.permissao || "vendedor").toLowerCase() as Permissao,
    };

    next();
  } catch (error) {
    console.error("Erro de autenticação:", error);
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
};

export const authorize =
  (...roles: Permissao[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Acesso não autorizado" });
    const allowed = new Set(roles.map((r) => r.toLowerCase()));
    if (!allowed.has(req.user.permissao)) {
      return res.status(403).json({ message: "Você não tem permissão para esta ação" });
    }
    next();
  };
