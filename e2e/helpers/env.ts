export const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
export const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';
export const E2E_NOTE_PREFIX = '[e2e]';

/** Contas exclusivas do E2E. Se não existirem, os testes as cadastram. */
export const USER_A = {
  email: process.env.E2E_USER_EMAIL || 'e2e.user.a@leemia.dev',
  password: process.env.E2E_USER_PASSWORD || 'E2e@Test123!',
  name: 'E2E User A',
};

export const USER_B = {
  email: process.env.E2E_USER_B_EMAIL || 'e2e.user.b@leemia.dev',
  password: process.env.E2E_USER_B_PASSWORD || 'E2e@Test123!',
  name: 'E2E User B',
};

export const PROFESSIONAL = {
  email: process.env.E2E_PROFESSIONAL_EMAIL || 'marina.costa@leemia.dev',
  password: process.env.E2E_PROFESSIONAL_PASSWORD || 'Senha@123',
};

export const INTRO_STORAGE_KEY = 'leemia-intro-v1';
