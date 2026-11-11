import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { asyncController, asyncHandler } from '../src/lib/async-handler';
import { isSensitiveEmail, maxAttemptsFor, retryDelayMs } from '../src/lib/email-retry';
import { AppError, httpError } from '../src/lib/http-error';
import { sniffImageType } from '../src/lib/image-signature';
import {
  consumeRateLimit,
  loginLockedUntil,
  registerLoginFailure,
  restoreRateLimits,
  takeDirtyRateLimits,
  LOGIN_FAILURE_LIMIT,
  LOGIN_LOCK_MS,
} from '../src/lib/rate-limit';
import { toErrorBody } from '../src/middlewares/errorHandler';
import { listAppointmentsQuerySchema } from '../src/schemas/appointment.schema';
import { createClientSchema } from '../src/schemas/auth.schema';
import { updateEmployeeSchema } from '../src/schemas/employee.schema';
import { upsertBusinessHourSchema } from '../src/schemas/schedule.schema';

const req = {} as Request;
const res = {} as Response;

function run(handler: ReturnType<typeof asyncHandler>) {
  return new Promise<unknown>((resolve) => {
    const next: NextFunction = (error?: unknown) => resolve(error);
    handler(req, res, next);
  });
}

describe('tratamento único de erro (ARQ-03)', () => {
  it('promise rejeitada num handler chega ao next', async () => {
    const boom = new Error('banco fora');
    const error = await run(
      asyncHandler(async () => {
        throw boom;
      }),
    );
    assert.equal(error, boom);
  });

  it('erro síncrono também chega ao next', async () => {
    const boom = httpError('Não pode', 409, 'NOPE');
    const error = await run(
      asyncHandler(() => {
        throw boom;
      }),
    );
    assert.equal(error, boom);
  });

  it('asyncController embrulha os métodos e mantém o this', async () => {
    class Controller {
      private readonly label = 'ok';
      async fail() {
        throw new Error(this.label);
      }
    }
    const controller = asyncController(new Controller());
    const error = await run(controller.fail);
    assert.ok(error instanceof Error);
    assert.equal((error as Error).message, 'ok');
  });

  it('httpError devolve um AppError que o errorHandler expõe com code e details', () => {
    const error = httpError('Já existe', 409, 'CLIENT_EXISTS', { client: { id: 'u1' } });
    assert.ok(error instanceof AppError);
    assert.ok(error instanceof Error);
    assert.deepEqual(toErrorBody(error), {
      statusCode: 409,
      message: 'Já existe',
      code: 'CLIENT_EXISTS',
      details: { client: { id: 'u1' } },
    });
  });
});

describe('novas tentativas da fila de e-mails (ARQ-02)', () => {
  it('e-mail comum tem 6 tentativas com espera crescente', () => {
    assert.equal(maxAttemptsFor('appointment-scheduled'), 6);
    assert.equal(retryDelayMs('appointment-scheduled', 1), 30_000);
    assert.equal(retryDelayMs('appointment-scheduled', 2), 2 * 60_000);
    assert.equal(retryDelayMs('appointment-scheduled', 5), 2 * 60 * 60_000);
    // Além da tabela, repete a última espera.
    assert.equal(retryDelayMs('appointment-scheduled', 9), 2 * 60 * 60_000);
  });

  it('e-mail com link de uso único desiste em poucos minutos', () => {
    for (const type of ['password-reset', 'email-verification', 'employee-invite']) {
      assert.equal(isSensitiveEmail(type), true);
      assert.equal(maxAttemptsFor(type), 4);
    }
    const total = [1, 2, 3].reduce((sum, n) => sum + retryDelayMs('password-reset', n), 0);
    assert.ok(total <= 6 * 60_000, 'as tentativas cabem em 6 minutos');
    assert.equal(isSensitiveEmail('welcome'), false);
  });
});

describe('contadores de rate limit que sobrevivem a um restart (SEC-08)', () => {
  const T0 = Date.UTC(2026, 10, 11, 12, 0, 0);

  it('o que mudou sai uma vez só, pronto para gravar', () => {
    takeDirtyRateLimits(T0);
    assert.equal(consumeRateLimit('persist:a', 2, 60_000, T0), true);
    const snapshots = takeDirtyRateLimits(T0);
    const bucket = snapshots.find((item) => item.key === 'b:persist:a');
    assert.ok(bucket && 'kind' in bucket);
    assert.equal(bucket.kind, 'bucket');
    assert.equal(bucket.expiresAt.getTime(), T0 + 60_000);
    assert.deepEqual(takeDirtyRateLimits(T0), []);
  });

  it('a contagem restaurada continua valendo: o limite não zera', () => {
    const restored = restoreRateLimits(
      [{ key: 'b:persist:b', kind: 'bucket', data: { windowMs: 60_000, stamps: [T0, T0 + 1] } }],
      T0 + 2,
    );
    assert.equal(restored, 1);
    assert.equal(consumeRateLimit('persist:b', 2, 60_000, T0 + 3), false);
  });

  it('bloqueio de login restaurado continua bloqueando', () => {
    const email = 'persist-lock@example.com';
    const ip = '10.9.9.9';
    restoreRateLimits(
      [
        {
          key: `l:${email}\n${ip}`,
          kind: 'login',
          data: { failures: LOGIN_FAILURE_LIMIT, windowStart: T0, lockedUntil: T0 + LOGIN_LOCK_MS },
        },
      ],
      T0 + 1000,
    );
    assert.equal(loginLockedUntil(email, ip, T0 + 1000)?.getTime(), T0 + LOGIN_LOCK_MS);
  });

  it('ignora linha vencida ou com formato inesperado', () => {
    const restored = restoreRateLimits(
      [
        { key: 'b:persist:old', kind: 'bucket', data: { windowMs: 1000, stamps: [T0] } },
        { key: 'b:persist:bad', kind: 'bucket', data: { stamps: 'x' } },
        { key: 'l:bad', kind: 'login', data: null },
      ],
      T0 + 60_000,
    );
    assert.equal(restored, 0);
  });

  it('falha de login entra na lista do que precisa ser gravado', () => {
    takeDirtyRateLimits(T0);
    registerLoginFailure('persist-dirty@example.com', '10.9.9.8', T0);
    const snapshots = takeDirtyRateLimits(T0);
    assert.equal(snapshots.length, 1);
    assert.ok(snapshots[0].key.startsWith('l:persist-dirty@example.com'));
  });
});

describe('tipo da foto pelos bytes do arquivo (SEC-09)', () => {
  it('reconhece JPEG, PNG, GIF e WEBP', () => {
    assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.mime, 'image/jpeg');
    assert.equal(
      sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext,
      'png',
    );
    assert.equal(sniffImageType(Buffer.from('GIF89a....', 'ascii'))?.mime, 'image/gif');
    assert.equal(
      sniffImageType(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary'))?.ext,
      'webp',
    );
  });

  it('recusa o que não é imagem, mesmo com extensão ou MIME de imagem', () => {
    assert.equal(sniffImageType(Buffer.from('<?php echo 1; ?>')), null);
    assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
    assert.equal(sniffImageType(Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt ', 'binary')), null);
    assert.equal(sniffImageType(Buffer.alloc(0)), null);
  });
});

describe('cliente rápido (UX-03)', () => {
  it('nome e telefone bastam; e-mail é opcional', () => {
    const data = createClientSchema.parse({ name: ' Ana Souza ', phone: '(11) 98888-7777' });
    assert.equal(data.name, 'Ana Souza');
    assert.equal(data.email, undefined);
  });

  it('aceita só e-mail, normalizado em minúsculas', () => {
    const data = createClientSchema.parse({ name: 'Ana', email: ' Ana@Example.COM ', phone: '' });
    assert.equal(data.email, 'ana@example.com');
  });

  it('recusa cliente sem nenhum contato e e-mail inválido', () => {
    assert.equal(createClientSchema.safeParse({ name: 'Ana' }).success, false);
    assert.equal(createClientSchema.safeParse({ name: 'Ana', email: 'ana@' }).success, false);
    assert.equal(createClientSchema.safeParse({ name: 'A', phone: '11988887777' }).success, false);
  });
});

describe('agenda paginada (UX-09) e pausas no formulário (UX-12)', () => {
  it('página e limite chegam como número; limite máximo de 200', () => {
    const query = listAppointmentsQuerySchema.parse({ page: '2', limit: '50', order: 'desc' });
    assert.equal(query.page, 2);
    assert.equal(query.limit, 50);
    assert.equal(query.order, 'desc');
    assert.equal(listAppointmentsQuerySchema.safeParse({ limit: '500' }).success, false);
    assert.equal(listAppointmentsQuerySchema.safeParse({ page: '0' }).success, false);
  });

  it('pausa precisa ter início antes do fim; no máximo 4 por dia', () => {
    const day = { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00' };
    assert.equal(
      upsertBusinessHourSchema.safeParse({ ...day, breaks: [{ start: '12:00', end: '13:00' }] })
        .success,
      true,
    );
    assert.equal(
      upsertBusinessHourSchema.safeParse({ ...day, breaks: [{ start: '13:00', end: '12:00' }] })
        .success,
      false,
    );
    const five = Array.from({ length: 5 }, (_, i) => ({ start: `1${i}:00`, end: `1${i}:30` }));
    assert.equal(upsertBusinessHourSchema.safeParse({ ...day, breaks: five }).success, false);
    // Sem `breaks`, o formulário antigo continua valendo.
    assert.equal(upsertBusinessHourSchema.parse(day).breaks, undefined);
  });

  it('respiro do profissional entre 0 e 120 minutos', () => {
    assert.equal(updateEmployeeSchema.parse({ bufferMinutes: 15 }).bufferMinutes, 15);
    assert.equal(updateEmployeeSchema.safeParse({ bufferMinutes: 121 }).success, false);
    assert.equal(updateEmployeeSchema.safeParse({ bufferMinutes: -5 }).success, false);
  });
});
