import { Request } from 'express';

export function configureTrustProxy() {
  const raw = process.env.TRUST_PROXY?.trim();
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true') return 1;
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  if (process.env.NODE_ENV === 'production') return 1;
  return false;
}

export function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}
