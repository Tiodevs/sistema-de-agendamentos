import { apiJson, getClientById, getClients } from './helpers/api';
import { assertNoSensitiveFields, getMe, uniqueAuthAccount, updateProfile } from './helpers/auth';
import { USER_A, WEB_URL } from './helpers/env';
import { e2eJwtSecret, signHs256, tamperJwtPayload, unsignedNoneJwt } from './helpers/jwt';
import { expect, test } from './fixtures';

test.describe('JWT e sessão', () => {
  test('rotas autenticadas recusam ausência, formato inválido e token lixo', async ({ api }) => {
    const missing = await api.fetch('/api/auth/me');
    expect(missing.status()).toBe(401);
    expect((await missing.json()).message).toMatch(/não fornecido/i);

    const malformed = await api.fetch('/api/auth/me', {
      headers: { Authorization: 'Token abc' },
    });
    expect(malformed.status()).toBe(401);
    expect((await malformed.json()).message).toMatch(/formato/i);

    const garbage = await getMe(api, 'nao-e-um-jwt');
    expect(garbage.status).toBe(401);
    expect(garbage.body.message).toMatch(/inválido ou expirado/i);
  });

  test('token alg=none e payload adulterado são recusados', async ({ api, userA }) => {
    const none = unsignedNoneJwt({
      id: userA.user.id,
      email: userA.user.email,
      role: 'ADMIN',
    });
    const noneResult = await getMe(api, none);
    expect(noneResult.status).toBe(401);

    const tampered = tamperJwtPayload(userA.token, { role: 'ADMIN' });
    const tamperedResult = await getMe(api, tampered);
    expect(tamperedResult.status).toBe(401);

    const clients = await getClients(api, tampered);
    expect(clients.status).toBe(401);
  });

  test('token na query string não autentica', async ({ api, userA }) => {
    const result = await api.fetch(`/api/auth/me?token=${encodeURIComponent(userA.token)}`);
    expect(result.status()).toBe(401);
  });

  test('JWT expirado é recusado quando o segredo local está disponível', async ({ api, userA }) => {
    const secret = e2eJwtSecret();
    test.skip(!secret, 'JWT_SECRET não está no ambiente do Playwright (apps/api/.env)');

    const now = Math.floor(Date.now() / 1000);
    const expired = signHs256(
      {
        id: userA.user.id,
        email: userA.user.email,
        role: 'USER',
        tv: 0,
        iat: now - 120,
        exp: now - 60,
      },
      secret,
    );
    const result = await getMe(api, expired);
    expect(result.status).toBe(401);
  });

  test('papel no JWT não é confiável: USER assinado como ADMIN continua USER', async ({
    api,
    userA,
  }) => {
    const secret = e2eJwtSecret();
    test.skip(!secret, 'JWT_SECRET não está no ambiente do Playwright (apps/api/.env)');

    const now = Math.floor(Date.now() / 1000);
    const forged = signHs256(
      {
        id: userA.user.id,
        email: userA.user.email,
        role: 'ADMIN',
        tv: 0,
        iat: now,
        exp: now + 3600,
      },
      secret,
    );

    const me = await getMe(api, forged);
    expect(me.status).toBe(200);
    expect(me.body.data?.user.role).toBe('USER');

    const clients = await getClients(api, forged);
    expect(clients.status).toBe(403);
  });
});

test.describe('Autorização do cliente', () => {
  test('USER não lista clientes, dashboard admin nem painel do profissional', async ({
    api,
    userA,
  }) => {
    const clients = await getClients(api, userA.token);
    expect(clients.status).toBe(403);

    const ownFile = await getClientById(api, userA.token, userA.user.id);
    expect(ownFile.status).toBe(403);

    const dashboard = await apiJson(api, 'GET', '/api/dashboard/stats', { token: userA.token });
    expect(dashboard.status).toBe(403);

    const professional = await apiJson(api, 'GET', '/api/professional/dashboard', {
      token: userA.token,
    });
    expect(professional.status).toBe(403);
  });

  test('PATCH /profile ignora role forjado e o cliente continua sem acesso admin', async ({
    api,
    userA,
  }) => {
    const promoted = await updateProfile(api, userA.token, {
      name: userA.user.name,
      email: userA.user.email,
      role: 'ADMIN',
    });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data?.user.role).toBe('USER');

    const stillMe = await getMe(api, userA.token);
    expect(stillMe.status).toBe(200);
    expect(stillMe.body.data?.user.role).toBe('USER');

    const clients = await getClients(api, userA.token);
    expect(clients.status).toBe(403);
  });
});

test.describe('Cabeçalhos HTTP e CORS', () => {
  test('API envia X-Content-Type-Options e não reflete origem estranha', async ({ api }) => {
    const health = await api.fetch('/api/health');
    expect(health.status()).toBe(200);
    expect(health.headers()['x-content-type-options']).toBe('nosniff');

    const webOrigin = new URL(WEB_URL).origin;
    const allowed = await api.fetch('/api/health', {
      headers: { Origin: webOrigin },
    });
    expect(allowed.headers()['access-control-allow-origin']).toBe(webOrigin);

    const blocked = await api.fetch('/api/health', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(blocked.headers()['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  test('resposta de login não inclui hash, active interno nem passwordChangedAt', async ({
    api,
    userA,
  }) => {
    const result = await apiJson(api, 'POST', '/api/auth/login', {
      data: { email: userA.user.email, password: USER_A.password },
    });
    expect(result.status).toBe(200);
    assertNoSensitiveFields(result.body);
    expect(JSON.stringify(result.body)).not.toMatch(/\$2[aby]\$/);
  });
});

test.describe('Lacunas de integridade do cadastro', { tag: '@gap' }, () => {
  test('dois cadastros simultâneos do mesmo e-mail não devem responder 500', async ({ api }) => {
    const account = uniqueAuthAccount('race');
    const payload = {
      name: account.name,
      email: account.email,
      password: account.password,
      phone: '(11) 90000-0001',
    };

    const [first, second] = await Promise.all([
      apiJson(api, 'POST', '/api/auth/register', { data: payload }),
      apiJson(api, 'POST', '/api/auth/register', { data: payload }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses.includes(500), `Esperado 201+409, veio ${statuses.join(' e ')}`).toBe(false);
    expect(statuses).toEqual([201, 409]);
  });
});
