import type { IncomingMessage, ServerResponse } from 'node:http';
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';

type WithLocals = ServerResponse & { locals?: { requestId?: unknown } };

const QUIET_PATHS = new Set(['/api/health', '/api/health/ready']);

/**
 * Uma linha de log por requisição, com o `requestId` do `requestIdMiddleware` (o mesmo do header
 * `X-Request-Id` e do corpo dos erros 5xx). Health checks não entram: o Railway chama a cada
 * poucos segundos.
 */
export const requestLogMiddleware = pinoHttp({
  logger,
  genReqId: (_req: IncomingMessage, res: ServerResponse) =>
    String((res as WithLocals).locals?.requestId ?? ''),
  // O id vai no topo da linha, com o mesmo nome usado no log de erro.
  customProps: (_req: IncomingMessage, res: ServerResponse) => ({
    requestId: (res as WithLocals).locals?.requestId,
  }),
  autoLogging: {
    ignore: (req: IncomingMessage) => QUIET_PATHS.has((req.url ?? '').split('?')[0]),
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  serializers: {
    req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
