import { createHash, randomBytes } from 'crypto';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const EMAIL_CHANGE_TTL_MS = 30 * 60 * 1000;
/** Confirmação do e-mail do cadastro: mais folga, porque a pessoa pode abrir o e-mail depois. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Convite do profissional (SEC-03): o estúdio cadastra e a pessoa pode demorar a abrir. */
export const EMPLOYEE_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createPasswordResetToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
