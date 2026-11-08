import { TIME_ZONE } from './datetime';
import { httpError } from './http-error';

type LoginLock = { failures: number; windowStart: number; lockedUntil: number };

const buckets = new Map<string, { windowMs: number; stamps: number[] }>();
/** Chave: e-mail + IP. Errar a senha de um IP não bloqueia o mesmo e-mail vindo de outro. */
const loginLocks = new Map<string, LoginLock>();
const MAX_KEYS = 10_000;
export const LOGIN_FAILURE_LIMIT = 5;
/** Janela em que as falhas se somam e duração do bloqueio. */
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

/** Cada chave guarda a própria janela: um limite diário não perde a contagem na limpeza. */
function prune(now: number) {
  if (buckets.size <= MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    const fresh = bucket.stamps.filter((stamp) => now - stamp < bucket.windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else bucket.stamps = fresh;
  }
}

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  prune(now);
  const windowStart = now - windowMs;
  const stamps = (buckets.get(key)?.stamps ?? []).filter((stamp) => stamp > windowStart);
  const allowed = stamps.length < limit;
  if (allowed) stamps.push(now);
  buckets.set(key, { windowMs, stamps });
  return allowed;
}

export function waitAtLeast(startedAt: number, minMs: number) {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    setTimeout(resolve, remaining);
  });
}

function loginLockKey(email: string, ip: string) {
  return `${email.trim().toLowerCase()}\n${ip}`;
}

function isStale(entry: LoginLock, now: number) {
  if (entry.lockedUntil) return entry.lockedUntil <= now;
  return now - entry.windowStart >= LOGIN_LOCK_MS;
}

function pruneLoginLocks(now: number) {
  if (loginLocks.size <= MAX_KEYS) return;
  for (const [key, entry] of loginLocks) {
    if (isStale(entry, now)) loginLocks.delete(key);
  }
}

/** Até quando o par e-mail + IP está bloqueado, ou `null` se pode tentar. */
export function loginLockedUntil(email: string, ip: string, now = Date.now()): Date | null {
  const key = loginLockKey(email, ip);
  const entry = loginLocks.get(key);
  if (!entry?.lockedUntil) return null;
  if (now < entry.lockedUntil) return new Date(entry.lockedUntil);
  loginLocks.delete(key);
  return null;
}

/**
 * Conta uma senha errada para o par e-mail + IP. Na 5ª falha dentro de 15 minutos o par fica
 * bloqueado por 15 minutos; devolve o fim do bloqueio quando esta falha o disparou.
 */
export function registerLoginFailure(email: string, ip: string, now = Date.now()): Date | null {
  pruneLoginLocks(now);
  const key = loginLockKey(email, ip);
  const current = loginLocks.get(key);
  if (current?.lockedUntil && now < current.lockedUntil) return new Date(current.lockedUntil);

  const fresh = !current || isStale(current, now);
  const entry: LoginLock = fresh
    ? { failures: 1, windowStart: now, lockedUntil: 0 }
    : { ...current, failures: current.failures + 1 };

  if (entry.failures >= LOGIN_FAILURE_LIMIT) {
    entry.lockedUntil = now + LOGIN_LOCK_MS;
  }
  loginLocks.set(key, entry);
  return entry.lockedUntil ? new Date(entry.lockedUntil) : null;
}

/**
 * 429 com o horário de liberação (arredondado para o minuto seguinte, no fuso de São Paulo).
 * Vale para qualquer e-mail, cadastrado ou não, então não revela se a conta existe.
 */
export function loginLockedError(lockedUntil: Date) {
  const nextMinute = new Date(Math.ceil(lockedUntil.getTime() / 60_000) * 60_000);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(nextMinute);
  return httpError(
    `Muitas tentativas de login. Tente novamente às ${time} ou redefina a senha.`,
    429,
    'LOGIN_LOCKED',
  );
}

/** Sem `ip`, libera o e-mail em todos os IPs (usado depois do reset de senha). */
export function clearLoginFailures(email: string, ip?: string) {
  if (ip !== undefined) {
    loginLocks.delete(loginLockKey(email, ip));
    return;
  }
  const prefix = loginLockKey(email, '');
  for (const key of loginLocks.keys()) {
    if (key.startsWith(prefix)) loginLocks.delete(key);
  }
}
