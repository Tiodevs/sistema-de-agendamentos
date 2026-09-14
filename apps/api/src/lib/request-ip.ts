import { Request } from 'express';

export function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (raw?.trim()) {
    return raw.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
