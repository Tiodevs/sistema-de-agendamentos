import { apiJson } from './helpers/api';
import {
  assertNoSensitiveFields,
  changePassword,
  confirmEmailChange,
  createFreshClient,
  FAKE_RESET_TOKEN,
  forgotPassword,
  GENERIC_RESET_MESSAGE,
  getMe,
  logoutSession,
  resetPassword,
  uniqueAuthAccount,
  updateProfile,
} from './helpers/auth';
import { USER_A } from './helpers/env';
import { decodeJwtPayload } from './helpers/jwt';
import { expect, test } from './fixtures';

test.describe('Login e registro na API', () => {
  test('login com credenciais válidas devolve JWT e perfil público', async ({ api, userA }) => {
    const result = await apiJson<{ user: (typeof userA)['user']; token: string }>(
      api,
      'POST',
      '/api/auth/login',
      { data: { email: USER_A.email, password: USER_A.password } },
    );

    expect(result.status).toBe(200);
    expect(result.body.data?.token).toBeTruthy();
    expect(result.body.data?.user.email).toBe(USER_A.email.toLowerCase());
    expect(result.body.data?.user.role).toBe('USER');
    assertNoSensitiveFields(result.body);

    const payload = decodeJwtPayload(result.body.data!.token);
    expect(payload.id).toBe(result.body.data?.user.id);
    expect(payload.email).toBe(USER_A.email.toLowerCase());
    expect(payload.role).toBe('USER');
    expect(typeof payload.tv).toBe('number');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(payload).not.toHaveProperty('password');
  });

  test('e-mail desconhecido e senha errada usam a mesma mensagem', async ({ api, userA }) => {
    const unknown = await apiJson(api, 'POST', '/api/auth/login', {
      data: { email: 'nao-existe-e2e@leemia.dev', password: 'Qualquer@123' },
    });
    const wrong = await apiJson(api, 'POST', '/api/auth/login', {
      data: { email: userA.user.email, password: 'SenhaErrada@123' },
    });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe('E-mail ou senha inválidos');
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  test('login recusa e-mail inválido e senha vazia', async ({ api }) => {
    const invalidEmail = await apiJson(api, 'POST', '/api/auth/login', {
      data: { email: 'nao-e-email', password: 'x' },
    });
    expect(invalidEmail.status).toBe(400);

    const emptyPassword = await apiJson(api, 'POST', '/api/auth/login', {
      data: { email: USER_A.email, password: '' },
    });
    expect(emptyPassword.status).toBe(400);
  });

  test('cadastro cria conta USER, ignora role forjado e já autentica', async ({ api }) => {
    const account = uniqueAuthAccount('register');
    const result = await apiJson<{
      user: { id: string; role: string; email: string };
      token: string;
    }>(api, 'POST', '/api/auth/register', {
      data: {
        name: account.name,
        email: account.email,
        password: account.password,
        phone: '(11) 90000-0001',
        role: 'ADMIN',
      },
    });

    expect(result.status).toBe(201);
    expect(result.body.data?.user.role).toBe('USER');
    expect(result.body.data?.user.email).toBe(account.email.toLowerCase());
    assertNoSensitiveFields(result.body);

    const payload = decodeJwtPayload(result.body.data!.token);
    expect(payload.role).toBe('USER');

    const me = await getMe(api, result.body.data!.token);
    expect(me.status).toBe(200);
    expect(me.body.data?.user.id).toBe(result.body.data?.user.id);
    expect(me.body.data?.user.role).toBe('USER');
  });

  test('cadastro recusa e-mail já usado', async ({ api, userA }) => {
    const result = await apiJson(api, 'POST', '/api/auth/register', {
      data: {
        name: 'Duplicado',
        email: userA.user.email,
        password: 'OutraSenha@123',
        phone: '(11) 90000-0001',
      },
    });
    expect(result.status).toBe(409);
    expect(result.body.message).toMatch(/já está em uso/i);
  });

  test('cadastro recusa senha curta, nome curto e e-mail inválido', async ({ api }) => {
    const shortPassword = await apiJson(api, 'POST', '/api/auth/register', {
      data: { name: 'Fulano', email: uniqueAuthAccount('short').email, password: '1234567' },
    });
    expect(shortPassword.status).toBe(400);

    const shortName = await apiJson(api, 'POST', '/api/auth/register', {
      data: {
        name: 'A',
        email: uniqueAuthAccount('name').email,
        password: 'Senha@123',
      },
    });
    expect(shortName.status).toBe(400);

    const invalidEmail = await apiJson(api, 'POST', '/api/auth/register', {
      data: { name: 'Fulano', email: 'sem-arroba', password: 'Senha@123' },
    });
    expect(invalidEmail.status).toBe(400);
  });

  test('cadastro recusa senha sem maiúscula ou caractere especial', async ({ api }) => {
    const onlyLength = await apiJson(api, 'POST', '/api/auth/register', {
      data: { name: 'Fulano', email: uniqueAuthAccount('weak1').email, password: '12345678' },
    });
    expect(onlyLength.status).toBe(400);

    const noSpecial = await apiJson(api, 'POST', '/api/auth/register', {
      data: { name: 'Fulano', email: uniqueAuthAccount('weak2').email, password: 'Abcdefgh' },
    });
    expect(noSpecial.status).toBe(400);

    const noUpper = await apiJson(api, 'POST', '/api/auth/register', {
      data: { name: 'Fulano', email: uniqueAuthAccount('weak3').email, password: 'abcdefg!' },
    });
    expect(noUpper.status).toBe(400);
  });
});

test.describe('Perfil e troca de senha autenticada', () => {
  test('GET /me exige token e devolve só o próprio perfil', async ({ api, userA }) => {
    const anonymous = await getMe(api);
    expect(anonymous.status).toBe(401);

    const mine = await getMe(api, userA.token);
    expect(mine.status).toBe(200);
    expect(mine.body.data?.user.id).toBe(userA.user.id);
    expect(mine.body.data?.user.email).toBe(userA.user.email);
    assertNoSensitiveFields(mine.body);
  });

  test('cliente atualiza o próprio nome e não consegue assumir e-mail de outra conta', async ({
    api,
    userA,
  }) => {
    const { account, token, user } = await createFreshClient(api, 'profile');

    const updated = await updateProfile(api, token, {
      name: `${account.name} Atualizado`,
      email: account.email,
      phone: '(11) 90000-0001',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data?.user.name).toBe(`${account.name} Atualizado`);
    expect(updated.body.data?.user.id).toBe(user.id);
    assertNoSensitiveFields(updated.body);

    const stolenEmail = await updateProfile(api, token, {
      name: account.name,
      email: USER_A.email,
    });
    expect(stolenEmail.status).toBe(409);

    const asAdmin = await updateProfile(api, token, {
      name: account.name,
      email: account.email,
      role: 'ADMIN',
    });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data?.user.role).toBe('USER');
    expect(asAdmin.body.data?.user.email).toBe(account.email.toLowerCase());

    const nextEmail = uniqueAuthAccount('newmail').email;
    const pending = await updateProfile(api, token, {
      name: account.name,
      email: nextEmail,
    });
    expect(pending.status).toBe(200);
    expect(pending.body.data?.user.email).toBe(account.email.toLowerCase());
    expect(pending.body.data?.user.pendingEmail).toBe(nextEmail.toLowerCase());

    const meAfterPending = await getMe(api, token);
    expect(meAfterPending.body.data?.user.email).toBe(account.email.toLowerCase());
    expect(meAfterPending.body.data?.user.pendingEmail).toBe(nextEmail.toLowerCase());

    const other = await getMe(api, userA.token);
    expect(other.body.data?.user.email).toBe(userA.user.email);
  });

  test('troca de senha exige a atual, recusa repetir e invalida JWTs antigos', async ({ api }) => {
    const { account, token } = await createFreshClient(api, 'pwd-rotate');

    const wrong = await changePassword(api, token, {
      currentPassword: 'SenhaErrada@123',
      newPassword: 'NovaSenha@123',
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/senha atual/i);

    const same = await changePassword(api, token, {
      currentPassword: account.password,
      newPassword: account.password,
    });
    expect(same.status).toBe(400);
    expect(`${same.body.message} ${JSON.stringify(same.body.errors || [])}`).toMatch(/diferente/i);

    const secondLogin = await apiJson<{ user: { id: string }; token: string }>(
      api,
      'POST',
      '/api/auth/login',
      { data: { email: account.email, password: account.password } },
    );
    expect(secondLogin.status).toBe(200);
    const otherSession = secondLogin.body.data!.token;

    const changed = await changePassword(api, token, {
      currentPassword: account.password,
      newPassword: `${account.password}X`,
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data?.token).toBeTruthy();
    expect(changed.body.data?.token).not.toBe(token);
    assertNoSensitiveFields(changed.body);

    const oldSession = await getMe(api, token);
    expect(oldSession.status).toBe(401);

    const sibling = await getMe(api, otherSession);
    expect(sibling.status).toBe(401);

    const fresh = await getMe(api, changed.body.data!.token);
    expect(fresh.status).toBe(200);
    expect(fresh.body.data?.user.email).toBe(account.email.toLowerCase());

    const oldPassword = await apiJson(api, 'POST', '/api/auth/login', {
      data: { email: account.email, password: account.password },
    });
    expect(oldPassword.status).toBe(401);

    const newPassword = await apiJson(api, 'POST', '/api/auth/login', {
      data: { email: account.email, password: `${account.password}X` },
    });
    expect(newPassword.status).toBe(200);
  });

  test('logout no servidor invalida o JWT atual e outras sessões da conta', async ({ api }) => {
    const { account, token } = await createFreshClient(api, 'logout');
    const secondLogin = await apiJson<{ user: { id: string }; token: string }>(
      api,
      'POST',
      '/api/auth/login',
      { data: { email: account.email, password: account.password } },
    );
    expect(secondLogin.status).toBe(200);
    const otherSession = secondLogin.body.data!.token;

    const loggedOut = await logoutSession(api, token);
    expect(loggedOut.status).toBe(200);

    const oldSession = await getMe(api, token);
    expect(oldSession.status).toBe(401);

    const sibling = await getMe(api, otherSession);
    expect(sibling.status).toBe(401);

    const again = await apiJson<{ token: string }>(api, 'POST', '/api/auth/login', {
      data: { email: account.email, password: account.password },
    });
    expect(again.status).toBe(200);
    const me = await getMe(api, again.body.data!.token);
    expect(me.status).toBe(200);
  });
});

test.describe('Recuperação de conta', () => {
  test('pedido de reset não revela se o e-mail existe e não devolve o token', async ({
    api,
    userA,
  }) => {
    const known = await forgotPassword(api, userA.user.email);
    const unknown = await forgotPassword(api, 'nunca-cadastrado-e2e@leemia.dev');

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(GENERIC_RESET_MESSAGE);
    expect(unknown.body.message).toBe(known.body.message);
    expect(known.body.data).toBeUndefined();
    expect(unknown.body.data).toBeUndefined();
    expect(JSON.stringify(known.body)).not.toMatch(/token/i);
  });

  test('pedido de reset recusa e-mail inválido', async ({ api }) => {
    const result = await forgotPassword(api, 'nao-e-email');
    expect(result.status).toBe(400);
  });

  test('redefinição recusa token ausente, malformado ou inexistente', async ({ api }) => {
    const missing = await apiJson(api, 'POST', '/api/auth/reset-password', {
      data: { password: 'NovaSenha@123' },
    });
    expect(missing.status).toBe(400);

    const malformed = await resetPassword(api, 'curto', 'NovaSenha@123');
    expect(malformed.status).toBe(400);

    const unknown = await resetPassword(api, FAKE_RESET_TOKEN, 'NovaSenha@123');
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toMatch(/inválido ou expirado/i);
    expect(unknown.body.data).toBeUndefined();
  });

  test('redefinição não aceita GET com o token na query', async ({ api }) => {
    const result = await api.fetch(`/api/auth/reset-password?token=${FAKE_RESET_TOKEN}`, {
      method: 'GET',
    });
    expect(result.status()).toBeGreaterThanOrEqual(400);
  });

  test('confirmação de e-mail recusa token inventado e não autentica por GET', async ({ api }) => {
    const unknown = await confirmEmailChange(api, FAKE_RESET_TOKEN);
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toMatch(/inválido ou expirado/i);

    const viaGet = await api.fetch(`/api/auth/confirm-email?token=${FAKE_RESET_TOKEN}`, {
      method: 'GET',
    });
    expect(viaGet.status()).toBeGreaterThanOrEqual(400);
  });
});
