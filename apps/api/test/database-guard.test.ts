import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { assertDisposableDatabase, productionDatabaseReason } from '../src/lib/database-guard';

const DEV_ENV = { NODE_ENV: 'development' };

describe('guarda contra o banco de produção (ARQ-01)', () => {
  it('recusa o túnel do Railway e os hosts do Railway', () => {
    for (const url of [
      'postgresql://postgres:x@127.0.0.1:5433/railway',
      'postgresql://postgres:x@localhost:5433/agendamentos',
      'postgresql://postgres:x@postgres.railway.internal:5432/railway',
      'postgresql://postgres:x@shuttle.proxy.rlwy.net:41234/app',
      'postgresql://postgres:x@10.0.0.5:5432/railway',
    ]) {
      assert.ok(productionDatabaseReason(url, DEV_ENV), url);
    }
  });

  it('aceita o Postgres do Docker, de dentro e de fora do compose', () => {
    for (const url of [
      'postgresql://agendamentos:x@db:5432/agendamentos',
      'postgresql://agendamentos:x@127.0.0.1:5434/agendamentos',
      'postgresql://postgres:x@localhost:5432/agendamentos_test',
    ]) {
      assert.equal(productionDatabaseReason(url, DEV_ENV), null, url);
    }
  });

  it('recusa quando NODE_ENV=production, seja qual for a URL', () => {
    const reason = productionDatabaseReason('postgresql://a:b@db:5432/agendamentos', {
      NODE_ENV: 'production',
    });
    assert.equal(reason, 'NODE_ENV=production');
  });

  it('assertDisposableDatabase explica o motivo e exige a URL', () => {
    assert.throws(
      () => assertDisposableDatabase('postgresql://p:x@127.0.0.1:5433/railway', 'Seed'),
      /Seed recusado/,
    );
    assert.throws(() => assertDisposableDatabase(undefined, 'E2E'), /DATABASE_URL não definida/);
  });
});
