import { Request, Response, NextFunction } from 'express';
import { consumeRateLimit, ipLimitFactor } from '../lib/rate-limit';
import { clientIp } from '../lib/request-ip';
import { AuthenticatedRequest } from './auth.middleware';

export function rateLimitByIp(prefix: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const scaled = limit * ipLimitFactor();
    if (!consumeRateLimit(`${prefix}:${clientIp(req)}`, scaled, windowMs)) {
      tooMany(res);
      return;
    }
    next();
  };
}

export function rateLimitByUser(prefix: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).user?.id || clientIp(req);
    if (!consumeRateLimit(`${prefix}:${userId}`, limit, windowMs)) {
      tooMany(res);
      return;
    }
    next();
  };
}

function tooMany(res: Response) {
  res.status(429).json({
    status: 'error',
    message: 'Muitas tentativas. Tente novamente em instantes.',
  });
}
