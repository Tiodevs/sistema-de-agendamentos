/**
 * Regras puras da fila de e-mails (ARQ-02): quantas tentativas cada tipo tem e quanto esperar
 * entre elas. O acesso ao banco e o worker ficam em `services/email-outbox.service`.
 */

/** E-mails com link de uso único: poucas tentativas, num intervalo curto, e o link sai do banco. */
const SENSITIVE_TYPES = new Set([
  'password-reset',
  'email-verification',
  'email-change-confirm',
  'employee-invite',
  'account-activation',
]);

const BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const SENSITIVE_BACKOFF_MS = [15_000, 60_000, 4 * 60_000];

export function isSensitiveEmail(type: string) {
  return SENSITIVE_TYPES.has(type);
}

export function maxAttemptsFor(type: string) {
  return (isSensitiveEmail(type) ? SENSITIVE_BACKOFF_MS : BACKOFF_MS).length + 1;
}

/** Espera antes da próxima tentativa, depois de `attempts` tentativas feitas. */
export function retryDelayMs(type: string, attempts: number) {
  const table = isSensitiveEmail(type) ? SENSITIVE_BACKOFF_MS : BACKOFF_MS;
  return table[Math.min(Math.max(attempts, 1), table.length) - 1];
}
