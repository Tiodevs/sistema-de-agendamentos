import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      status: 'error',
      message: 'Token não fornecido',
    });
    return;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      status: 'error',
      message: 'Formato de token inválido',
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch {
    res.status(401).json({
      status: 'error',
      message: 'Token inválido ou expirado',
    });
    return;
  }
};
