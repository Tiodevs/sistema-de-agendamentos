import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * A suíte E2E na CI (job `e2e` do .github/workflows/ci.yml). É a `playwright.config.ts` mais os
 * dois servidores, que o Playwright sobe antes do global setup e derruba no fim. Na máquina, a
 * suíte roda contra o ambiente Docker, com a configuração padrão (e2e/README.md).
 *
 * Espera prontos: o build da API (`apps/api/dist`) e o do web (`apps/web/.next`), o banco de
 * DATABASE_URL migrado e com seed, e JWT_SECRET e SEED_PASSWORD no ambiente.
 */
if (!process.env.CI) {
  // Fora da CI, a API daqui subiria com o DATABASE_URL que estiver no ambiente da máquina.
  throw new Error(
    'playwright.ci.config.ts é só para a CI. Na máquina, use `npm run test:e2e` contra o ambiente Docker (e2e/README.md).',
  );
}

export default defineConfig({
  ...base,
  // As falhas também viram anotações na pull request.
  reporter: [['list'], ['github'], ['html', { open: 'never' }]],
  webServer: [
    {
      // A API como no docker-compose.yml: modo produção, Swagger ligado, sem proxy confiável e
      // CORS só para o web local. Sem RESEND_API_KEY e S3_*, e-mail só vai para o log e upload de
      // foto responde 503. DATABASE_URL e JWT_SECRET vêm do ambiente do job.
      command: 'node dist/server.js',
      cwd: 'apps/api',
      // Pronta quando alcança o banco.
      url: 'http://localhost:3001/api/health/ready',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        APP_URL: 'http://localhost:3000',
        CORS_ORIGINS: 'http://localhost:3000',
        PUBLIC_API_URL: 'http://localhost:3001',
        SWAGGER_ENABLED: 'true',
        TRUST_PROXY: 'false',
        JWT_EXPIRES_IN: '12h',
        CANCELLATION_NOTICE_HOURS: '2',
        // A suíte inteira faz mais de 80 logins do mesmo IP em 15 minutos (o limite de
        // /api/auth/login). Só aqui os limites por IP valem 10 vezes; nenhum teste depende deles.
        RATE_LIMIT_IP_FACTOR: '10',
        // O `dotenv/config` da API não lê nenhum .env: tudo vem daqui e do ambiente do job.
        DOTENV_CONFIG_PATH: '.env.ci-nao-existe',
      },
    },
    {
      // O build de produção do web (`next start` na porta 3000).
      command: 'npm run start --workspace=apps/web',
      url: 'http://localhost:3000/login',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
