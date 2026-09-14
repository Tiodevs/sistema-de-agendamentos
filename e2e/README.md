# Testes E2E

Cobrem o fluxo do cliente no agendamento e o fluxo de autenticação (login, cadastro, JWT, recuperação e troca de senha).

Qualquer agendamento criado usa a nota `[e2e]` e é removido do banco (hard delete) ao final de cada teste. Contas `e2e.user.*` e `e2e.auth.*` também são apagadas no teardown da suíte — nada desses testes deve permanecer.

## Pré-requisitos

1. Túnel do Postgres (`npm run db:tunnel`), API e web no ar (`npm run dev`).
2. Seed de serviços/profissionais no banco (os clientes de teste são criados pela própria suíte).
3. `DATABASE_URL` em `apps/api/.env` apontando para o túnel — é o que os testes usam para o hard delete.

O README do projeto avisa que o banco local é o de produção. Os testes de agenda marcam datas futuras (cerca de duas semanas à frente) e apagam o registro depois. Só contas cujo e-mail começa com `e2e.user.` ou `e2e.auth.` são removidas; profissionais do seed não. Evite rodá-los contra um ambiente com clientes reais se puder.

O `forgot-password` tem teto de 8 pedidos/hora por IP: não dispare essa rota em loop. Contas `*@leemia.dev` não recebem e-mail (`canSendTo`); os testes de reset cobrem pedido genérico e token inválido, não a caixa de entrada.

Senha nova (cadastro, reset, troca autenticada): mínimo 8, uma maiúscula e um caractere especial. Login de contas antigas continua aceitando a senha atual.

## Comandos

Na raiz do monorepo:

```bash
npx playwright install chromium   # primeira vez
npm run test:e2e                  # suíte estável (agenda + auth, sem @gap)
npm run test:e2e:auth             # só autenticação
npm run test:e2e:gaps             # regressão das regras de integridade/privacidade
npm run test:e2e:all              # as duas juntas
npm run test:e2e:ui               # interface do Playwright
```

Variáveis opcionais: `E2E_WEB_URL`, `E2E_API_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`, `E2E_PROFESSIONAL_EMAIL`, `E2E_PROFESSIONAL_PASSWORD`.

Os testes de JWT expirado / papel forjado leem `JWT_SECRET` de `apps/api/.env` se a variável ainda não estiver no ambiente. Não versionar esse arquivo.

## Relatórios

- Agendamento: [RELATORIO-INTEGRIDADE.md](./RELATORIO-INTEGRIDADE.md)
- Autenticação: [RELATORIO-AUTENTICACAO.md](./RELATORIO-AUTENTICACAO.md)
