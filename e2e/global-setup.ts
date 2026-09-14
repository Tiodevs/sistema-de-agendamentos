import { ensureReusableE2eUsers, sweepE2eDatabase } from './helpers/db';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';

async function assertReachable(url: string, label: string) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok && response.status >= 500) {
      throw new Error(`${label} respondeu ${response.status} em ${url}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${label} não está acessível em ${url}. Rode \`npm run dev\` (e o túnel do banco, se precisar) antes dos testes E2E. Detalhe: ${detail}`,
    );
  }
}

async function assertDatabase() {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-probe@leemia.dev', password: 'invalid' }),
  });

  if (response.status >= 500) {
    throw new Error(
      'A API está no ar, mas não alcança o Postgres (em geral 127.0.0.1:5433). Rode `npm run db:tunnel` em outro terminal e tente de novo.',
    );
  }
}

export default async function globalSetup() {
  await assertReachable(`${API_URL}/api/health`, 'API');
  await assertReachable(WEB_URL, 'Web');
  await assertDatabase();
  await sweepE2eDatabase('leftover');
  await ensureReusableE2eUsers();
}
