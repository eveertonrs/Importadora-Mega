import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    nome: string;
    permissao: string;
  };
}

export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization;

  if (!bearer || !bearer.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Acesso não autorizado" });
  }

  const token = bearer.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; nome: string; permissao: string; };
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Erro de autenticação:", error);
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
};
