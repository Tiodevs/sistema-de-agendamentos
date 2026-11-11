import { afterEach, beforeEach, describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  ApiError,
  getMe,
  getProducts,
  isAbortError,
  loginUser,
  logoutSession,
  setUnauthorizedHandler,
} from '../src/lib/api';

// O cliente lê o token de `window.localStorage`. Aqui um navegador de mentira, só com isso.
const globals = globalThis as Record<string, unknown>;
const realFetch = globalThis.fetch;
const realWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

let storedToken: string | null = null;
let unauthorizedCalls: string[] = [];
let lastRequest: { url: string; init: RequestInit } | null = null;

function mockFetch(reply: (init: RequestInit) => Response | Promise<Response>) {
  globals.fetch = async (url: string, init: RequestInit = {}) => {
    lastRequest = { url, init };
    return reply(init);
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function restore(name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete globals[name];
}

beforeEach(() => {
  storedToken = null;
  unauthorizedCalls = [];
  lastRequest = null;
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: (key: string) => (key === 'token' ? storedToken : null) },
    configurable: true,
  });
  setUnauthorizedHandler((token) => unauthorizedCalls.push(token));
});

afterEach(() => {
  setUnauthorizedHandler(null);
  globals.fetch = realFetch;
  restore('window', realWindow);
  restore('localStorage', realStorage);
});

describe('cliente HTTP (ARQ-09)', () => {
  it('manda o token e devolve o corpo no sucesso', async () => {
    storedToken = 'jwt-1';
    mockFetch(() => json(200, { status: 'success', data: { products: [] } }));

    const response = await getProducts();

    assert.deepEqual(response.data, { products: [] });
    assert.ok(lastRequest);
    assert.match(lastRequest.url, /\/api\/products$/);
    assert.equal(new Headers(lastRequest.init.headers).get('Authorization'), 'Bearer jwt-1');
    assert.ok(lastRequest.init.signal instanceof AbortSignal, 'toda chamada sai com prazo');
  });

  it('falha de rede vira ApiError NETWORK, não "Failed to fetch"', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    await assert.rejects(getProducts(), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 0);
      assert.equal(error.code, 'NETWORK');
      assert.doesNotMatch(error.message, /fetch/i);
      return true;
    });
  });

  it('401 em chamada autenticada avisa o handler central, com o token usado', async () => {
    storedToken = 'jwt-vencido';
    mockFetch(() => json(401, { status: 'error', message: 'Token inválido ou expirado' }));

    await assert.rejects(getProducts(), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, 'Sua sessão expirou. Entre de novo para continuar.');
      return true;
    });
    assert.deepEqual(unauthorizedCalls, ['jwt-vencido']);
  });

  it('401 sem token (visitante) não aciona o handler', async () => {
    mockFetch(() => json(401, { status: 'error', message: 'Token não fornecido' }));

    await assert.rejects(getProducts(), ApiError);
    assert.deepEqual(unauthorizedCalls, []);
  });

  it('401 do login e do logout não derrubam a sessão', async () => {
    storedToken = 'jwt-1';
    mockFetch(() => json(401, { status: 'error', message: 'E-mail ou senha inválidos' }));

    await assert.rejects(loginUser({ email: 'a@b.co', password: 'x' }), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, 'E-mail ou senha inválidos');
      return true;
    });
    await assert.rejects(logoutSession(), ApiError);
    assert.deepEqual(unauthorizedCalls, []);
  });

  it('cancelamento de quem chamou segue como abort', async () => {
    const controller = new AbortController();
    mockFetch(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    const pending = getMe(controller.signal);
    controller.abort();

    await assert.rejects(pending, (error: unknown) => {
      assert.equal(isAbortError(error), true);
      assert.equal(error instanceof ApiError, false);
      return true;
    });
  });

  it('5xx que não é JSON (proxy fora do ar) vira mensagem amigável', async () => {
    mockFetch(() => new Response('<html>Bad Gateway</html>', { status: 502 }));

    await assert.rejects(getProducts(), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 502);
      assert.doesNotMatch(error.message, /html|gateway/i);
      return true;
    });
  });

  it('sucesso que não é JSON é resposta inválida', async () => {
    mockFetch(() => new Response('ok', { status: 200 }));

    await assert.rejects(getProducts(), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, 'Resposta inválida do servidor');
      return true;
    });
  });
});
