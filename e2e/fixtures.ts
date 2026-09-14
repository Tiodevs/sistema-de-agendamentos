import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { ensureClient, login, type AuthUser } from './helpers/api';
import { hardDeleteAppointments, sweepE2eDatabase } from './helpers/db';
import { API_URL, PROFESSIONAL, USER_A, USER_B } from './helpers/env';

export type TestSession = {
  token: string;
  user: AuthUser;
  createdIds: string[];
};

async function createClientSession(
  api: APIRequestContext,
  account: { name: string; email: string; password: string },
): Promise<TestSession> {
  const data = await ensureClient(api, account);
  return { token: data.token, user: data.user, createdIds: [] };
}

export const test = base.extend<{
  e2eCleanup: void;
  api: APIRequestContext;
  userA: TestSession;
  userB: TestSession;
  professional: TestSession;
}>({
  e2eCleanup: [
    async ({}, use) => {
      await use();
      await sweepE2eDatabase('leftover');
    },
    { auto: true },
  ],
  api: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(context);
    await context.dispose();
  },
  userA: async ({ api }, use) => {
    const session = await createClientSession(api, USER_A);
    await use(session);
    await hardDeleteAppointments(session.createdIds);
  },
  userB: async ({ api }, use) => {
    const session = await createClientSession(api, USER_B);
    await use(session);
    await hardDeleteAppointments(session.createdIds);
  },
  professional: async ({ api }, use) => {
    try {
      const data = await login(api, PROFESSIONAL.email, PROFESSIONAL.password);
      const session = { token: data.token, user: data.user, createdIds: [] };
      await use(session);
      await hardDeleteAppointments(session.createdIds);
    } catch {
      await use({
        token: '',
        user: {
          id: '',
          name: PROFESSIONAL.email,
          email: PROFESSIONAL.email,
          phone: null,
          role: 'EMPLOYEE',
          employeeId: null,
          avatarUrl: null,
          createdAt: new Date().toISOString(),
        },
        createdIds: [],
      });
    }
  },
});

export { expect };
