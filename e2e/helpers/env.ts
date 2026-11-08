import { randomBytes } from 'node:crypto';
import { loadE2eEnv } from './load-env';

// Antes de ler qualquer variável: traz o .env da raiz (ambiente Docker).
loadE2eEnv();

export const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
export const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';
export const E2E_NOTE_PREFIX = '[e2e]';

/**
 * Senha das contas `e2e.user.*`, que a própria suíte cria. Sem E2E_USER_PASSWORD, cada execução
 * sorteia uma. Fica no process.env para o global setup e os workers usarem a mesma.
 */
function runPassword() {
  if (!process.env.E2E_RUN_PASSWORD) {
    process.env.E2E_RUN_PASSWORD = `E2e@${randomBytes(12).toString('base64url')}`;
  }
  return process.env.E2E_RUN_PASSWORD;
}

/** Contas exclusivas do E2E. Se não existirem, os testes as cadastram. */
export const USER_A = {
  email: process.env.E2E_USER_EMAIL || 'e2e.user.a@leemia.dev',
  password: process.env.E2E_USER_PASSWORD || runPassword(),
  name: 'E2E User A',
};

export const USER_B = {
  email: process.env.E2E_USER_B_EMAIL || 'e2e.user.b@leemia.dev',
  password: process.env.E2E_USER_B_PASSWORD || process.env.E2E_USER_PASSWORD || runPassword(),
  name: 'E2E User B',
};

/**
 * Contas do seed. Não há senha padrão no código: use a SEED_PASSWORD do seed ou as variáveis
 * E2E_PROFESSIONAL_PASSWORD e E2E_ADMIN_PASSWORD. Sem senha, os testes que dependem delas pulam.
 */
export const PROFESSIONAL = {
  email: process.env.E2E_PROFESSIONAL_EMAIL || 'marina.costa@leemia.dev',
  password: process.env.E2E_PROFESSIONAL_PASSWORD || process.env.SEED_PASSWORD || '',
};

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'admin@leemia.dev',
  password: process.env.E2E_ADMIN_PASSWORD || process.env.SEED_PASSWORD || '',
};
