import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_LOCK_MS,
  clearLoginFailures,
  loginLockedError,
  loginLockedUntil,
  registerLoginFailure,
} from '../src/lib/rate-limit';

const T0 = Date.UTC(2026, 10, 7, 17, 0, 0);

function failTimes(email: string, ip: string, times: number, now = T0) {
  let lockedUntil: Date | null = null;
  for (let i = 0; i < times; i += 1) lockedUntil = registerLoginFailure(email, ip, now);
  return lockedUntil;
}

describe('bloqueio de login (SEC-04)', () => {
  it('bloqueia o par e-mail + IP na 5ª falha', () => {
    const email = 'lock-a@example.com';
    assert.equal(failTimes(email, '10.0.0.1', LOGIN_FAILURE_LIMIT - 1), null);
    assert.equal(loginLockedUntil(email, '10.0.0.1', T0), null);

    const lockedUntil = registerLoginFailure(email, '10.0.0.1', T0);
    assert.equal(lockedUntil?.getTime(), T0 + LOGIN_LOCK_MS);
    assert.equal(loginLockedUntil(email, '10.0.0.1', T0)?.getTime(), T0 + LOGIN_LOCK_MS);
  });

  it('tentativas de outro IP não bloqueiam o login legítimo', () => {
    const email = 'lock-b@example.com';
    failTimes(email, '203.0.113.9', LOGIN_FAILURE_LIMIT + 3);

    assert.notEqual(loginLockedUntil(email, '203.0.113.9', T0), null);
    assert.equal(loginLockedUntil(email, '198.51.100.7', T0), null);
  });

  it('o reset de senha libera a conta em todos os IPs', () => {
    const email = 'lock-c@example.com';
    failTimes(email, '10.0.0.1', LOGIN_FAILURE_LIMIT);
    failTimes(email, '10.0.0.2', LOGIN_FAILURE_LIMIT);
    failTimes('outra-conta@example.com', '10.0.0.1', LOGIN_FAILURE_LIMIT);

    clearLoginFailures(email);

    assert.equal(loginLockedUntil(email, '10.0.0.1', T0), null);
    assert.equal(loginLockedUntil(email, '10.0.0.2', T0), null);
    assert.notEqual(loginLockedUntil('outra-conta@example.com', '10.0.0.1', T0), null);
  });

  it('o bloqueio acaba depois de 15 minutos', () => {
    const email = 'lock-d@example.com';
    failTimes(email, '10.0.0.1', LOGIN_FAILURE_LIMIT);

    assert.notEqual(loginLockedUntil(email, '10.0.0.1', T0 + LOGIN_LOCK_MS - 1), null);
    assert.equal(loginLockedUntil(email, '10.0.0.1', T0 + LOGIN_LOCK_MS), null);
  });

  it('falhas antigas não se somam às novas', () => {
    const email = 'lock-e@example.com';
    failTimes(email, '10.0.0.1', LOGIN_FAILURE_LIMIT - 1, T0);

    const later = T0 + LOGIN_LOCK_MS + 1;
    assert.equal(registerLoginFailure(email, '10.0.0.1', later), null);
    assert.equal(loginLockedUntil(email, '10.0.0.1', later), null);
  });

  it('e-mail com caixa diferente conta como o mesmo', () => {
    failTimes('Lock-F@Example.com', '10.0.0.1', LOGIN_FAILURE_LIMIT);
    assert.notEqual(loginLockedUntil('lock-f@example.com', '10.0.0.1', T0), null);
  });

  it('a mensagem diz quando tentar de novo, no horário de São Paulo', () => {
    // 17:00:30 UTC = 14:00:30 em São Paulo → arredonda para 14:01.
    const error = loginLockedError(new Date(T0 + 30_000));
    assert.equal(error.statusCode, 429);
    assert.equal(error.code, 'LOGIN_LOCKED');
    assert.match(error.message, /às 14:01/);
  });
});
