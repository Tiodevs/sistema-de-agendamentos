import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

/** Um id por requisição, no header `X-Request-Id`, nos logs e no corpo dos erros 5xx. */
export function requestIdMiddleware(_req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
