import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { verifyAccessToken, type AccessTokenClaims } from '../lib/jwt';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenClaims;
}

function unauthorized(res: Response) {
  res.status(401).json({
    status: 'error',
    message: 'Token inválido ou expirado',
  });
}

function readBearerToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { error: 'missing' as const };
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return { error: 'format' as const };
  return { token: parts[1] };
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const bearer = readBearerToken(req);

  if ('error' in bearer && bearer.error === 'missing') {
    res.status(401).json({
      status: 'error',
      message: 'Token não fornecido',
    });
    return;
  }

  if ('error' in bearer && bearer.error === 'format') {
    res.status(401).json({
      status: 'error',
      message: 'Formato de token inválido',
    });
    return;
  }

  const token = 'token' in bearer ? bearer.token : '';

  let decoded: AccessTokenClaims;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    unauthorized(res);
    return;
  }

  void (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { active: true, passwordChangedAt: true, role: true, tokenVersion: true },
      });

      if (!user?.active) {
        unauthorized(res);
        return;
      }

      const tokenVersion = Number(decoded.tv ?? 0);
      if (tokenVersion !== Number(user.tokenVersion)) {
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
