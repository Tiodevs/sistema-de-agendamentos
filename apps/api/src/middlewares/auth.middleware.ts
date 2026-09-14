import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { getJwtSecret } from '../lib/jwt';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

function unauthorized(res: Response) {
  res.status(401).json({
    status: 'error',
    message: 'Token inválido ou expirado',
  });
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

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    unauthorized(res);
    return;
  }

  void (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { active: true, passwordChangedAt: true, role: true },
      });

      if (!user?.active) {
        unauthorized(res);
        return;
      }

      if (user.passwordChangedAt) {
        const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (!decoded.iat || decoded.iat < changedAtSec) {
          unauthorized(res);
          return;
        }
      }

      (req as AuthenticatedRequest).user = { ...decoded, role: user.role };
      next();
    } catch (error) {
      next(error);
    }
  })();
};
