import type { APIRequestContext } from '@playwright/test';
import { apiJson, login, registerClient, type AuthUser } from './api';
import { insertE2eUser, trackE2eEmail } from './db';

export const GENERIC_RESET_MESSAGE =
  'Se este e-mail estiver cadastrado, você receberá as instruções em instantes.';

export const RESET_TOKEN_STORAGE_KEY = 'leemia-password-reset-token';

/** Token com formato aceito pelo Zod, mas que não existe no banco. */
export const FAKE_RESET_TOKEN = `e2e_reset_${'A'.repeat(40)}`;

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordChangedAt',
  'tokenHash',
  'tokenVersion',
  'hash',
  'salt',
  'secret',
]);

export function uniqueAuthAccount(label = 'user') {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const account = {
    name: `E2E Auth ${label} ${stamp.slice(-6)}`,
    email: `e2e.auth.${label}.${stamp}@leemia.dev`,
    password: `E2e@Auth1!${stamp.slice(0, 8)}`,
  };
  trackE2eEmail(account.email);
  return account;
}

export function assertNoSensitiveFields(value: unknown, path = 'response') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      throw new Error(`Campo sensível "${key}" vazou em ${path}`);
    }
    assertNoSensitiveFields(nested, `${path}.${key}`);
  }
}

export async function getMe(api: APIRequestContext, token?: string) {
  return apiJson<{ user: AuthUser }>(api, 'GET', '/api/auth/me', { token });
}

export async function updateProfile(
  api: APIRequestContext,
  token: string,
  data: { name: string; email: string; phone?: string; role?: string },
) {
  return apiJson<{ user: AuthUser }>(api, 'PATCH', '/api/auth/profile', { token, data });
}

export async function changePassword(
  api: APIRequestContext,
  token: string,
  data: { currentPassword: string; newPassword: string },
) {
  return apiJson<{ user: AuthUser; token: string }>(api, 'POST', '/api/auth/password', {
    token,
    data,
  });
}

export async function forgotPassword(api: APIRequestContext, email: string) {
  return apiJson(api, 'POST', '/api/auth/forgot-password', { data: { email } });
}

export async function resetPassword(api: APIRequestContext, token: string, password: string) {
  return apiJson(api, 'POST', '/api/auth/reset-password', { data: { token, password } });
}

export async function confirmEmailChange(api: APIRequestContext, token: string) {
  return apiJson(api, 'POST', '/api/auth/confirm-email', { data: { token } });
}

export async function logoutSession(api: APIRequestContext, token: string) {
  return apiJson(api, 'POST', '/api/auth/logout', { token });
}

export async function createFreshClient(api: APIRequestContext, label = 'fresh') {
  const account = uniqueAuthAccount(label);
  const created = await registerClient(api, account);
  if (created.status === 201 && created.body.data?.token && created.body.data.user) {
    assertNoSensitiveFields(created.body);
    return { account, token: created.body.data.token, user: created.body.data.user };
  }

  if (created.status === 429) {
    await insertE2eUser(account);
    const data = await login(api, account.email, account.password);
    return { account, token: data.token, user: data.user };
  }

  throw new Error(
    `Não criou conta E2E (${created.status}): ${created.body.message || 'sem mensagem'}.`,
  );
}
