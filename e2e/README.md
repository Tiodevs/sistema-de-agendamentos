# Testes E2E de agendamento

Cobrem o fluxo do cliente: só é possível escolher horários livres na interface, conflito de agenda na API, cancelamento e checagens de autorização.

Qualquer agendamento criado usa a nota `[e2e]` e é cancelado ao final.

## Pré-requisitos

1. Túnel do Postgres (`npm run db:tunnel`), API e web no ar (`npm run dev`).
2. Seed de serviços/profissionais no banco (os clientes de teste são criados pela própria suíte).

O README do projeto avisa que o banco local é o de produção. Os testes agendam em datas futuras (cerca de duas semanas à frente) e cancelam depois, mas evite rodá-los contra um ambiente com clientes reais se puder.

## Comandos

Na raiz do monorepo:

```bash
npx playwright install chromium   # primeira vez
npm run test:e2e                  # suíte estável
npm run test:e2e:gaps             # regressão das regras de integridade/privacidade
npm run test:e2e:all              # as duas juntas
npm run test:e2e:ui               # interface do Playwright
```

Variáveis opcionais: `E2E_WEB_URL`, `E2E_API_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`, `E2E_PROFESSIONAL_EMAIL`, `E2E_PROFESSIONAL_PASSWORD`.

O relatório das regras de integridade e segurança está em [RELATORIO-INTEGRIDADE.md](./RELATORIO-INTEGRIDADE.md).
