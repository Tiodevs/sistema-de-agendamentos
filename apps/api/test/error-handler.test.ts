import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { toErrorBody } from '../src/middlewares/errorHandler';
import { httpError } from '../src/lib/http-error';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(
    `Invalid \`prisma.user.create()\` invocation: ${code}`,
    {
      code,
      clientVersion: 'test',
    },
  );
}

describe('errorHandler (SEC-05 / DOM-06)', () => {
  it('erro desconhecido vira 500 genérico, sem a mensagem interna', () => {
    const body = toErrorBody(
      new Error('Invalid `prisma.appointment.findMany()` invocation in /app/x.ts'),
    );
    assert.equal(body.statusCode, 500);
    assert.equal(body.message, 'Erro interno do servidor');
  });

  it('mapeia os códigos do Prisma para 409, 404 e 503', () => {
    assert.equal(toErrorBody(prismaError('P2002')).statusCode, 409);
    assert.equal(toErrorBody(prismaError('P2003')).statusCode, 409);
    assert.equal(toErrorBody(prismaError('P2025')).statusCode, 404);
    assert.equal(toErrorBody(prismaError('P1001')).statusCode, 503);
    assert.equal(toErrorBody(prismaError('P2024')).statusCode, 503);

    for (const code of ['P2002', 'P2003', 'P2025', 'P1001']) {
      assert.doesNotMatch(toErrorBody(prismaError(code)).message, /prisma|invocation/i);
    }
  });

  it('sobreposição de horário no banco (23P01) vira 409', () => {
    const error = Object.assign(new Error('conflicting key value violates exclusion constraint'), {
      cause: { code: '23P01' },
    });
    assert.equal(toErrorBody(error).statusCode, 409);
  });

  it('banco fora do ar vira 503', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    const body = toErrorBody(error);
    assert.equal(body.statusCode, 503);
    assert.doesNotMatch(body.message, /ECONNREFUSED|127\.0\.0\.1/);
  });

  it('mantém mensagem e código dos erros da aplicação', () => {
    const body = toErrorBody(httpError('Confirme seu e-mail', 403, 'EMAIL_NOT_VERIFIED'));
    assert.deepEqual(body, {
      statusCode: 403,
      message: 'Confirme seu e-mail',
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('ZodError vira 400 com os campos', () => {
    const result = z.object({ status: z.enum(['A']) }).safeParse({ status: 'B' });
    assert.equal(result.success, false);
    const body = toErrorBody(result.error);
    assert.equal(body.statusCode, 400);
    assert.equal(body.errors?.[0]?.field, 'status');
  });

  it('JSON malformado vira 400 em português', () => {
    const error = Object.assign(new SyntaxError('Unexpected token } in JSON at position 9'), {
      status: 400,
      statusCode: 400,
      expose: true,
      type: 'entity.parse.failed',
    });
    assert.deepEqual(toErrorBody(error), {
      statusCode: 400,
      message: 'JSON inválido no corpo da requisição',
    });
  });
});
