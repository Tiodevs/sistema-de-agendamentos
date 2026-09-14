const buckets = new Map<string, number[]>();
const loginLocks = new Map<string, { failures: number; lockedUntil: number }>();
const MAX_KEYS = 10_000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function prune(now: number) {
  if (buckets.size <= MAX_KEYS) return;
  for (const [key, timestamps] of buckets) {
    const fresh = timestamps.filter((stamp) => now - stamp < 60 * 60 * 1000);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  prune(now);
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((stamp) => stamp > windowStart);
  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return true;
}

export function waitAtLeast(startedAt: number, minMs: number) {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    setTimeout(resolve, remaining);
  });
}

function pruneLoginLocks(now: number) {
  if (loginLocks.size <= MAX_KEYS) return;
  for (const [key, entry] of loginLocks) {
    if (entry.lockedUntil > 0 && entry.lockedUntil < now) {
      loginLocks.delete(key);
    }
  }
}

export function isLoginLocked(email: string) {
  const entry = loginLocks.get(email);
  if (!entry?.lockedUntil) return false;
  if (Date.now() < entry.lockedUntil) return true;
  loginLocks.delete(email);
  return false;
}

export function registerLoginFailure(email: string) {
  const now = Date.now();
  pruneLoginLocks(now);
  const current = loginLocks.get(email);
  if (current?.lockedUntil && now < current.lockedUntil) return;

  const base = current?.lockedUntil && now >= current.lockedUntil ? 0 : (current?.failures ?? 0);
  const failures = base + 1;
  if (failures >= LOGIN_FAILURE_LIMIT) {
    loginLocks.set(email, { failures, lockedUntil: now + LOGIN_LOCK_MS });
    return;
  }
  loginLocks.set(email, { failures, lockedUntil: 0 });
}

export function clearLoginFailures(email: string) {
  loginLocks.delete(email);
}
