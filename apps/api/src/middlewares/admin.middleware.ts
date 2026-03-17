import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    res.status(401).json({
      status: 'error',
      message: 'Não autenticado',
    });
    return;
  }

  if (user.role !== 'ADMIN') {
    res.status(403).json({
      status: 'error',
      message: 'Acesso restrito a administradores',
    });
    return;
  }

  next();
};
