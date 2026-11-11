import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ipLimitFactor } from '../src/lib/rate-limit';

describe('multiplicador dos limites por IP (RATE_LIMIT_IP_FACTOR)', () => {
  it('sem a variável, os limites ficam como estão', () => {
    assert.equal(ipLimitFactor({}), 1);
  });

  it('a CI aumenta os limites com um inteiro maior que 1', () => {
    assert.equal(ipLimitFactor({ RATE_LIMIT_IP_FACTOR: '10' }), 10);
    assert.equal(ipLimitFactor({ RATE_LIMIT_IP_FACTOR: '2.9' }), 2);
  });

  it('valor inválido, zero ou negativo nunca afrouxa nem zera o limite', () => {
    for (const value of ['', 'abc', '0', '-5', '0.5', 'Infinity']) {
      assert.equal(ipLimitFactor({ RATE_LIMIT_IP_FACTOR: value }), 1, value);
    }
  });
});
