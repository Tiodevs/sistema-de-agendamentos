import { createHmac } from 'node:crypto';
import { loadApiEnv } from './load-api-env';

export type JwtPayload = {
  id?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
};

export function e2eJwtSecret() {
  loadApiEnv();
  return process.env.JWT_SECRET || '';
}

export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('JWT malformado');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as JwtPayload;
}

export function unsignedNoneJwt(payload: JwtPayload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

export function tamperJwtPayload(token: string, patch: Partial<JwtPayload>) {
  const [header, , signature = ''] = token.split('.');
  const current = decodeJwtPayload(token);
  const body = Buffer.from(JSON.stringify({ ...current, ...patch })).toString('base64url');
  return `${header}.${body}.${signature}`;
}

export function signHs256(payload: JwtPayload, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}
