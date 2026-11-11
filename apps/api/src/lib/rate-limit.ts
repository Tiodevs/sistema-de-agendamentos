import { TIME_ZONE } from './datetime';
import { httpError } from './http-error';

type LoginLock = { failures: number; windowStart: number; lockedUntil: number };

const buckets = new Map<string, { windowMs: number; stamps: number[] }>();
/** Chave: e-mail + IP. Errar a senha de um IP não bloqueia o mesmo e-mail vindo de outro. */
const loginLocks = new Map<string, LoginLock>();
const MAX_KEYS = 10_000;
/**
 * Chaves que mudaram desde a última gravação no banco (SEC-08). Prefixo `b:` = janela deslizante,
 * `l:` = bloqueio de login. Quem grava é o `rate-limit-store`.
 */
const dirty = new Set<string>();
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

/**
 * Multiplicador dos limites por IP (`rateLimitByIp`), de `RATE_LIMIT_IP_FACTOR`. Padrão 1. Só a CI
 * o aumenta: a suíte E2E inteira faz mais de 80 logins do mesmo IP em 15 minutos. Valor ausente,
 * inválido ou menor que 1 vale 1, então nenhum erro de configuração afrouxa a produção sem querer.
 */
export function ipLimitFactor(env: NodeJS.ProcessEnv = process.env) {
  const value = Number(env.RATE_LIMIT_IP_FACTOR);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  prune(now);
  const windowStart = now - windowMs;
  const stamps = (buckets.get(key)?.stamps ?? []).filter((stamp) => stamp > windowStart);
  const allowed = stamps.length < limit;
  if (allowed) {
    stamps.push(now);
    dirty.add(`b:${key}`);
  }
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
  dirty.add(`l:${key}`);
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
    const key = loginLockKey(email, ip);
    if (loginLocks.delete(key)) dirty.add(`l:${key}`);
    return;
  }
  const prefix = loginLockKey(email, '');
  for (const key of loginLocks.keys()) {
    if (key.startsWith(prefix)) {
      loginLocks.delete(key);
      dirty.add(`l:${key}`);
    }
  }
}

/* ───────────── Persistência (SEC-08) ───────────── */

export type RateLimitSnapshot =
  | { key: string; kind: 'bucket' | 'login'; data: unknown; expiresAt: Date }
  | { key: string; deleted: true };

/**
 * O que mudou desde a última chamada, pronto para gravar: o estado atual de cada chave ou a marca
 * de que ela foi apagada. Esvazia a lista de pendências.
 */
export function takeDirtyRateLimits(now = Date.now()): RateLimitSnapshot[] {
  const snapshots: RateLimitSnapshot[] = [];
  for (const id of dirty) {
    const key = id.slice(2);
    if (id.startsWith('b:')) {
      const bucket = buckets.get(key);
      const stamps = bucket?.stamps.filter((stamp) => now - stamp < bucket.windowMs) ?? [];
      if (!bucket || stamps.length === 0) {
        snapshots.push({ key: id, deleted: true });
      } else {
        snapshots.push({
          key: id,
          kind: 'bucket',
          data: { windowMs: bucket.windowMs, stamps },
          expiresAt: new Date(Math.max(...stamps) + bucket.windowMs),
        });
      }
      continue;
    }
    const entry = loginLocks.get(key);
    if (!entry || isStale(entry, now)) {
      snapshots.push({ key: id, deleted: true });
    } else {
      snapshots.push({
        key: id,
        kind: 'login',
        data: entry,
        expiresAt: new Date(entry.lockedUntil || entry.windowStart + LOGIN_LOCK_MS),
      });
    }
  }
  dirty.clear();
  return snapshots;
}

/** Devolve as chaves à lista de pendências quando a gravação falha. */
export function markRateLimitsDirty(keys: string[]) {
  for (const key of keys) dirty.add(key);
}

function isBucketData(data: unknown): data is { windowMs: number; stamps: number[] } {
  const value = data as { windowMs?: unknown; stamps?: unknown } | null;
  return (
    !!value &&
    typeof value.windowMs === 'number' &&
    Array.isArray(value.stamps) &&
    value.stamps.every((stamp) => typeof stamp === 'number')
  );
}

function isLoginData(data: unknown): data is LoginLock {
  const value = data as Partial<LoginLock> | null;
  return (
    !!value &&
    typeof value.failures === 'number' &&
    typeof value.windowStart === 'number' &&
    typeof value.lockedUntil === 'number'
  );
}

/**
 * Carrega o que estava gravado, na subida da API. O que já está em memória (requisições que
 * chegaram antes da carga) tem prioridade. Linha com formato inesperado é ignorada.
 */
export function restoreRateLimits(
  rows: Array<{ key: string; kind: string; data: unknown }>,
  now = Date.now(),
) {
  let restored = 0;
  for (const row of rows) {
    const key = row.key.slice(2);
    if (row.key.startsWith('b:') && isBucketData(row.data)) {
      if (buckets.has(key)) continue;
      const { windowMs, stamps } = row.data;
      const fresh = stamps.filter((stamp) => now - stamp < windowMs);
      if (fresh.length === 0) continue;
      buckets.set(key, { windowMs, stamps: fresh });
      restored += 1;
    } else if (row.key.startsWith('l:') && isLoginData(row.data)) {
      if (loginLocks.has(key) || isStale(row.data, now)) continue;
      loginLocks.set(key, { ...row.data });
      restored += 1;
    }
  }
  return restored;
}
