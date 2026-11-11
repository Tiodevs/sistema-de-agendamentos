import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ApiError,
  INVALID_RESPONSE_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  apiErrorMessage,
  apiFieldErrors,
  errorFromFailure,
  errorFromResponse,
  isAbortError,
  isApiError,
} from '../src/lib/api-error';
import { createRequestSignal } from '../src/lib/request-signal';

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

describe('falha sem resposta → ApiError (ARQ-09)', () => {
  it('erro de rede vira mensagem em português, com statusCode 0', () => {
    const error = errorFromFailure(new TypeError('Failed to fetch'), {
      callerAborted: false,
      timedOut: false,
    });
    assert.ok(isApiError(error));
    assert.equal(error.statusCode, 0);
    assert.equal(error.code, 'NETWORK');
    assert.equal(error.message, NETWORK_ERROR_MESSAGE);
  });

  it('prazo estourado vira TIMEOUT', () => {
    for (const cause of [abortError(), new DOMException('timeout', 'TimeoutError')]) {
      const error = errorFromFailure(cause, { callerAborted: false, timedOut: true });
      assert.ok(isApiError(error));
      assert.equal(error.statusCode, 0);
      assert.equal(error.code, 'TIMEOUT');
      assert.equal(error.message, TIMEOUT_ERROR_MESSAGE);
    }
  });

  it('TimeoutError do navegador conta como prazo mesmo sem a marca', () => {
    const error = errorFromFailure(new DOMException('timeout', 'TimeoutError'), {
      callerAborted: false,
      timedOut: false,
    });
    assert.ok(isApiError(error));
    assert.equal(error.code, 'TIMEOUT');
  });

  it('cancelamento de quem chamou segue como abort, não vira ApiError', () => {
    const cause = abortError();
    const error = errorFromFailure(cause, { callerAborted: true, timedOut: false });
    assert.equal(error, cause);
    assert.equal(isAbortError(error), true);
    assert.equal(isApiError(error), false);
  });

  it('quem cancelou vence o prazo quando os dois aconteceram', () => {
    const cause = abortError();
    assert.equal(errorFromFailure(cause, { callerAborted: true, timedOut: true }), cause);
  });

  it('abort de origem desconhecida continua sendo abort', () => {
    const cause = abortError();
    assert.equal(errorFromFailure(cause, { callerAborted: false, timedOut: false }), cause);
  });
});

describe('resposta de erro → ApiError (ARQ-09)', () => {
  it('4xx mantém a mensagem, o código, os campos e os detalhes da API', () => {
    const error = errorFromResponse(409, {
      message: 'Este horário acabou de ser reservado',
      code: 'SLOT_TAKEN',
      errors: [{ field: 'date', message: 'Indisponível' }],
      details: { appointments: [] },
    });
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, 'Este horário acabou de ser reservado');
    assert.equal(error.code, 'SLOT_TAKEN');
    assert.deepEqual(error.errors, [{ field: 'date', message: 'Indisponível' }]);
    assert.deepEqual(error.details, { appointments: [] });
  });

  it('4xx sem mensagem ou sem JSON ainda tem texto', () => {
    assert.equal(errorFromResponse(400, {}).message, 'Erro na requisição');
    assert.equal(errorFromResponse(404, null).message, INVALID_RESPONSE_MESSAGE);
  });

  it('500 genérico ou sem corpo vira a mensagem amigável', () => {
    assert.equal(
      errorFromResponse(500, { message: 'Erro interno do servidor' }).message,
      SERVER_ERROR_MESSAGE,
    );
    assert.equal(errorFromResponse(502, null).message, SERVER_ERROR_MESSAGE);
    assert.equal(errorFromResponse(500, { message: '   ' }).message, SERVER_ERROR_MESSAGE);
    assert.equal(errorFromResponse(500, {}).statusCode, 500);
  });

  it('5xx com mensagem útil da API é mantido', () => {
    const message = 'Serviço temporariamente indisponível. Tente novamente em instantes.';
    assert.equal(errorFromResponse(503, { message }).message, message);
  });
});

describe('mensagem para a tela (ARQ-09)', () => {
  it('usa a mensagem do ApiError, inclusive rede e prazo', () => {
    assert.equal(
      apiErrorMessage(new ApiError(400, 'E-mail já cadastrado'), 'padrão'),
      'E-mail já cadastrado',
    );
    const network = errorFromFailure(new TypeError('Failed to fetch'), {
      callerAborted: false,
      timedOut: false,
    });
    assert.equal(apiErrorMessage(network, 'padrão'), NETWORK_ERROR_MESSAGE);
    const timeout = errorFromFailure(abortError(), { callerAborted: false, timedOut: true });
    assert.equal(apiErrorMessage(timeout, 'padrão'), TIMEOUT_ERROR_MESSAGE);
  });

  it('qualquer outra coisa cai no texto da tela, nunca no texto cru do navegador', () => {
    assert.equal(apiErrorMessage(new TypeError('Failed to fetch'), 'padrão'), 'padrão');
    assert.equal(apiErrorMessage({ message: 'objeto solto' }, 'padrão'), 'padrão');
    assert.equal(apiErrorMessage(undefined, 'padrão'), 'padrão');
    assert.equal(apiErrorMessage(new ApiError(400, ''), 'padrão'), 'padrão');
  });

  it('erros por campo viram um mapa, ou null quando não há', () => {
    const error = new ApiError(400, 'Dados inválidos', [
      { field: 'email', message: 'E-mail inválido' },
      { field: 'password', message: 'Senha curta' },
    ]);
    assert.deepEqual(apiFieldErrors(error), { email: 'E-mail inválido', password: 'Senha curta' });
    assert.equal(apiFieldErrors(new ApiError(400, 'Dados inválidos', [])), null);
    assert.equal(apiFieldErrors(new ApiError(401, 'E-mail ou senha inválidos')), null);
    assert.equal(apiFieldErrors({ errors: [{ field: 'x', message: 'y' }] }), null);
  });
});

describe('prazo da requisição (ARQ-09)', () => {
  for (const useNative of [true, false]) {
    const label = useNative ? 'AbortSignal.any/timeout' : 'fallback com AbortController';

    it(`${label}: estoura o prazo e marca timedOut`, async () => {
      const request = createRequestSignal(undefined, 10, useNative);
      assert.equal(request.signal.aborted, false);
      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.equal(request.signal.aborted, true);
      assert.equal(request.timedOut(), true);
      request.dispose();
    });

    it(`${label}: cancelamento de quem chamou não conta como prazo`, () => {
      const caller = new AbortController();
      const request = createRequestSignal(caller.signal, 5_000, useNative);
      caller.abort();
      assert.equal(request.signal.aborted, true);
      assert.equal(request.timedOut(), false);
      request.dispose();
    });

    it(`${label}: signal já cancelado sai cancelado`, () => {
      const caller = new AbortController();
      caller.abort();
      const request = createRequestSignal(caller.signal, 5_000, useNative);
      assert.equal(request.signal.aborted, true);
      assert.equal(request.timedOut(), false);
      request.dispose();
    });
  }

  it('fallback: dispose solta o timer e não cancela depois', async () => {
    const request = createRequestSignal(undefined, 10, false);
    request.dispose();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(request.signal.aborted, false);
    assert.equal(request.timedOut(), false);
  });
});
