# Testes E2E

Cobrem o fluxo do cliente no agendamento (inclusive os limites da reserva) e o fluxo de autenticação (login, cadastro, JWT, recuperação e troca de senha).

Qualquer agendamento criado usa a nota `[e2e]` e é removido do banco (hard delete) ao final de cada teste. Contas `e2e.user.*` e `e2e.auth.*` também são apagadas no teardown da suíte — nada desses testes deve permanecer.

## Pré-requisitos

1. Ambiente Docker no ar e com seed (veja o [README](../readme.md)):
   `docker compose up -d --build --wait` e `docker compose run --rm seed`.
2. O `.env` da raiz preenchido. A suíte o carrega sozinha (sem sobrescrever o que já estiver no ambiente) e tira dele:
   - a URL do Postgres do container (`POSTGRES_*` → `E2E_DATABASE_URL`), usada no hard delete;
   - `SEED_PASSWORD`, para os testes que entram como admin ou profissional (sem ela, esses testes pulam);
   - `JWT_SECRET`, para os testes de JWT expirado e papel forjado.

A suíte não lê `apps/api/.env`, que pode ter chaves de produção.

O E2E se recusa a rodar contra o banco de produção (`apps/api/src/lib/database-guard.ts`): host do Railway, banco `railway`, porta 5433 do túnel ou `NODE_ENV=production`. No setup, ele também confere que a API em `E2E_API_URL` usa o mesmo banco: grava a conta `e2e.user.a` com uma senha sorteada e tenta entrar com ela pela API.

O `forgot-password` tem teto de 8 pedidos/hora por IP: não dispare essa rota em loop. Contas `*@leemia.dev` não recebem e-mail (`canSendTo`); os testes de reset cobrem pedido genérico e token inválido, não a caixa de entrada, e a confirmação de e-mail é feita direto no banco (`markEmailVerified`).

Senha nova (cadastro, reset, troca autenticada): mínimo 8, uma maiúscula e um caractere especial. Login de contas antigas continua aceitando a senha atual.

## Comandos

Na raiz do monorepo, com as variáveis acima no ambiente:

```bash
npx playwright install chromium   # primeira vez
npm run test:e2e                  # suíte estável (agenda + auth, sem @gap)
npm run test:e2e:auth             # só autenticação
npm run test:e2e:gaps             # regressão das regras de integridade/privacidade
npm run test:e2e:all              # as duas juntas
npm run test:e2e:ui               # interface do Playwright
```

Variáveis opcionais: `E2E_WEB_URL`, `E2E_API_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`, `E2E_PROFESSIONAL_EMAIL`, `E2E_PROFESSIONAL_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`. Não há senha padrão no código: sem `E2E_USER_PASSWORD`, cada execução sorteia a das contas `e2e.user.*`.

## Na CI

O job `e2e` do [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda a suíte estável num Postgres 18 descartável do próprio runner: aplica as migrations, roda o seed com uma `SEED_PASSWORD` sorteada na hora, builda a API e o web e sobe os dois pelo [`playwright.ci.config.ts`](../playwright.ci.config.ts), com a API nos mesmos valores do `docker-compose.yml`. Quando falha, o relatório HTML e os rastros ficam 7 dias no artefato `e2e-report` da execução. Essa configuração recusa rodar fora da CI.

## Relatórios

- Agendamento: [RELATORIO-INTEGRIDADE.md](./RELATORIO-INTEGRIDADE.md)
- Autenticação: [RELATORIO-AUTENTICACAO.md](./RELATORIO-AUTENTICACAO.md)
