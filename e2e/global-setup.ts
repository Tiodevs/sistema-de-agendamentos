import { e2eDatabaseUrl, ensureReusableE2eUsers, sweepE2eDatabase } from './helpers/db';
import { USER_A } from './helpers/env';

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
      `${label} não está acessível em ${url}. Suba o ambiente Docker (\`docker compose up -d --wait\`) antes dos testes E2E. Detalhe: ${detail}`,
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
      'A API está no ar, mas não alcança o Postgres. Confira `docker compose ps` e os logs da API.',
    );
  }
}

/**
 * USER_A acabou de ser gravado direto no banco do E2E com a senha sorteada nesta execução.
 * Se a API não aceita essa senha, ela está ligada a outro banco (por exemplo, o de produção).
 */
async function assertApiUsesE2eDatabase() {
  if (!/^e2e\.user\./i.test(USER_A.email)) return;

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER_A.email, password: USER_A.password }),
  });

  if (response.status !== 200) {
    throw new Error(
      `A API em ${API_URL} não reconhece a conta que o E2E acabou de gravar (login ${response.status}). ` +
        'Ela não usa o banco de E2E_DATABASE_URL: rode a suíte contra o Docker.',
    );
  }
}

export default async function globalSetup() {
  e2eDatabaseUrl();
  await assertReachable(`${API_URL}/api/health`, 'API');
  await assertReachable(WEB_URL, 'Web');
  await assertDatabase();
  await sweepE2eDatabase('leftover');
  await ensureReusableE2eUsers();
  await assertApiUsesE2eDatabase();
}
