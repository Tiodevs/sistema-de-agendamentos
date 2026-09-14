# Backlogs do projeto

Inventário consciente do que o sistema **ainda não faz**, ou faz de um jeito que vai doer quando o uso crescer. Não é sprint nem ordem de commit.

O que já está no ar: cadastro/login JWT, perfil com troca de e-mail confirmada, reset de senha, reserva em 3 passos, conflito do profissional (`FOR UPDATE` + `EXCLUDE`), cancelamento do cliente, CRUD de catálogo/equipe, expediente + dias especiais, expediente/folga por profissional (fallback do estúdio), dashboards admin/profissional e e-mail transacional (Resend). Detalhe em [docs/aplicacao.md](./docs/aplicacao.md). Revisões pontuais: [e2e/RELATORIO-AUTENTICACAO.md](./e2e/RELATORIO-AUTENTICACAO.md) e [e2e/RELATORIO-INTEGRIDADE.md](./e2e/RELATORIO-INTEGRIDADE.md).

---

## Funcionalidades

### Reagendar horário

Cliente e admin só cancelam (ou o admin apaga) e marcam de novo. Não há `PATCH` de data/profissional/serviço nem tela de “trocar horário”.

**Fazer:** fluxo de reagendamento que reaproveite a grade e a trava de overlap, notificando cliente e profissional.

### Antecedência mínima para cancelar

`PATCH /appointments/:id/cancel` aceita qualquer futuro em `SCHEDULED`/`CONFIRMED`. `NO_SHOW` e `CANCELLED` já liberam o slot na hora.

**Fazer:** política (ex.: 2h ou 24h). Depois disso, só admin cancela — ou o horário conta como falta.

### Expediente por profissional

`business_hours` e `special_days` continuam sendo o padrão do estúdio. Cada profissional pode ter `employee_business_hours` e `employee_special_days`; sem essas linhas, herda o estabelecimento. Estúdio fechado (feriado ou domingo) fecha todo mundo. Folga do profissional fecha só a agenda dele.

**Ainda falta:** intervalos / almoço e folga mínima entre agendamentos do mesmo profissional.

### Sobreposição do mesmo cliente

A regra de conflito é só do profissional. O mesmo cliente pode marcar 10:00 com a Marina e 10:00 com o Rafael. É comportamento mantido nos testes, não um bug.

**Fazer só se o produto mudar:** recusar overlap por `clientId` (ou avisar na UI e deixar o admin forçar).

### Lista de espera e recorrência

Não há fila quando o slot enche, nem série semanal/mensal. Quem perdeu o horário precisa tentar de novo à mão.

### Área do cliente incompleta no dia a dia

- Cadastro já autentica e manda boas-vindas. Não confirma o e-mail antes de usar a conta (confirmação existe só na **troca** de e-mail do perfil).
- “Meus horários” é lista + busca local. Sem reagendar, remarcar, adicionar ao calendário (ICS/Google) nem comprovante para imprimir.
- O sino do shell aponta para a lista de agendamentos. Não há centro de notificações, badge nem preferências de aviso.

**Fazer (primeiro):** confirmar e-mail no cadastro, ou pelo menos não tratar o endereço como verificado.

### Admin opera catálogo e agenda, não a base de clientes

Não existe `/admin/clients`. `GET /api/auth/clients` busca até 50 usuários ativos, só no fluxo “novo agendamento”. Não dá para desativar conta, promover a admin, ver histórico por pessoa nem anotar preferências.

Papel `ADMIN` nasce no seed/banco. Criar funcionário com o **mesmo e-mail** de um `USER` vira `EMPLOYEE` sem tela de confirmação.

**Fazer:** tela de clientes (listar, buscar, desativar, histórico) e promoção de papel explícita na UI.

### Agenda administrativa é lista, não calendário

`/admin/appointments` e `/professional/agenda` carregam a coleção e filtram no browser. Sem visão semana/mês, arrastar horário, paginação na API nem recorte `from`/`to` obrigatório.

Com volume, a tela e o `findAll` sem `take` viram problema.

**Fazer:** calendário semanal + paginação/cursor na API (admin e profissional).

### Exclusão física apaga histórico (ou quebra no banco)

Admin pode `DELETE` agendamento, produto e funcionário. Agendamento some do histórico. Produto/funcionário com reserva ativa estoura FK no Postgres (`appointments` não tem `onDelete: Cascade` nessas relações) — a UI não trata isso como “desative em vez de apagar”.

Já existe `active` em produto e funcionário; o caminho seguro é só o toggle.

**Fazer:** bloquear delete com dependência (409 claro) e preferir exclusão lógica nos agendamentos.

### Profissional não fecha o ciclo sozinho

A API dele só avança para `CONFIRMED`, `IN_PROGRESS` ou `COMPLETED`. Não cancela, não marca `NO_SHOW`, não cria encaixe. Reserva nova entra como `SCHEDULED` até alguém confirmar à mão.

**Fazer:** no-show e cancelamento (com regra de antecedência) no painel do profissional; opcionalmente auto-confirmar ao criar.

### Receita do dashboard mistura o que ainda não aconteceu

A soma usa `SCHEDULED | CONFIRMED | IN_PROGRESS | COMPLETED`. Cancelado/no-show ficam de fora, mas horário só marcado já conta como receita.

**Fazer:** KPI de faturado (`COMPLETED`) separado de previsto (ainda na agenda).

### Sem CRM operacional extra

Não há comissão, meta, estoque de produtos físicos, avaliação do atendimento, walk-in/senha de espera nem exportação CSV/PDF do período.

### Comunicação: confirma, mas quase não lembra nem avisa mudança

Hoje o Resend cobre: boas-vindas, novo agendamento (cliente + profissional), cancelamento (**só o cliente**), reset/troca de senha e troca de e-mail.

Falta:

- Lembrete (D-1 / 1h) — não há cron, fila nem job na API.
- Aviso ao profissional no cancelamento.
- E-mail quando o admin muda status (exceto para `CANCELLED`).
- WhatsApp / SMS (fora do produto de propósito, até haver canal).

Falha de envio só vai para o log; a reserva já está gravada. Sem retry além do que o Resend fizer.

**Fazer:** worker/cron de lembrete + e-mail de cancelamento para o profissional. Canal WhatsApp só com provedor e opt-in.

### Pagamento, multi-empresa e o resto grande

Fora de escopo até haver pedido explícito: checkout/sinal, multi-tenant, sync de calendário externo, PWA, i18n, tema claro no cliente (admin já alterna).

---

## Técnicos

### Autenticação

Itens da passagem de auth; o restante do módulo está no relatório de autenticação.

#### Cadastro paralelo do mesmo e-mail pode responder 500

O `findUnique` + `create` não trata `P2002`. Dois `POST /register` ao mesmo tempo passam da checagem e um estoura unique no Postgres.

**Fazer:** capturar unique do Prisma e responder `409`, de preferência num `create` único. Coberto por `npm run test:e2e:gaps` (`dois cadastros simultâneos...`).

#### Cookie `httpOnly` + refresh rotativo

O JWT ainda vai no `localStorage` e no JSON de login. Logout e `tokenVersion` já derrubam **todas** as sessões da conta no servidor, mas XSS na origem continua lendo o Bearer. Não há sessão por dispositivo: um “Sair” invalida o celular e o computador juntos.

**Fazer:** cookie `httpOnly` + `Secure` + `SameSite`, TTL curto, refresh rotativo (e, se fizer sentido, sessão por device). No setup atual (Vercel + API no Railway) isso pede proxy same-origin no Next (`rewrites` para a API em produção) ou `SameSite=None` com CORS `credentials`. Sem isso o cookie não viaja bem entre os dois hosts. O rewrite de [apps/web/next.config.ts](./apps/web/next.config.ts) só aponta para `localhost:3001`.

#### Rate limit compartilhado e CAPTCHA

Lockout de login é por e-mail, em memória do processo. Restart da API zera a conta; mais de uma instância não compartilha o mapa. IP usa `req.ip` (com `trust proxy` em produção).

**Fazer se o tráfego exigir:** store compartilhado (Redis ou equivalente), teto de login mais baixo, CAPTCHA após N falhas. Evitar Redis só “por ter” — aumenta custo.

#### Política de senha além da complexidade local

Cadastro/reset/troca exigem maiúscula e caractere especial. Não há denylist de senhas comuns nem consulta Have I Been Pwned (k-anonymity).

#### 2FA

Não há segundo fator.

#### Enumeração de e-mail no cadastro e no perfil

`409 E-mail já está em uso` confirma contas existentes. Esperado para UX; mensagem genérica no cadastro (“se o e-mail estiver livre, enviamos o próximo passo”) fica para depois.

#### Avatar público

`GET /api/users/:id/avatar` não exige autenticação. Quem souber o id baixa a foto.

### Dados e API

- Tratar `P2002` (e `P2003` de FK) de forma genérica no `errorHandler`, não só no cadastro.
- Health (`GET /api/health`) não fala com o Postgres — liveness, não readiness.
- Swagger `servers` ainda cita `http://localhost:3001`.
- Listagens grandes (`appointments`, `my`, agenda do profissional) sem paginação.
- `packages/` do monorepo está vazio; front e API duplicam tipos de agendamento/status.
- E-mail e qualquer trabalho atrasado rodam in-process (`void task().catch`). Sem fila, a API não lembra horário futuro se o processo morrer no meio.

### Infra e operação

- Local e produção usam o **mesmo** Postgres (túnel SSH). Seed e E2E mexem em dado real. Isolar banco de dev/E2E.
- Deploy da API é `railway up` / upload — o serviço não está ligado ao GitHub. Web na Vercel sim. Sem CI (não há `.github/workflows`).
- Ajustar `JWT_EXPIRES_IN` no Railway para `12h` se a variável ainda estiver `7d` (o padrão do código já é 12h).
- Observabilidade: Morgan em `dev`, `console.error` no handler. Sem APM, métricas de negócio nem alerta de 5xx.
- Backup/restore do Postgres não está documentado no repo (fica o que o Railway retém).
- [docs/aplicacao.md](./docs/aplicacao.md) ainda diz que não há testes automatizados — a suíte Playwright em `e2e/` já existe.

### Qualidade e testes

E2E cobre cliente (book + auth) com Chromium só. Quase não há UI/API de admin (CRUD, expediente, dashboard) nem do profissional (status). Sem testes unitários dos services.

Happy path de reset/confirmação de e-mail no E2E ainda depende da caixa `leemia.dev` (inserir hash no banco ou interceptar o provedor).

**Fazer:** Postgres de teste isolado; um fluxo admin + um fluxo profissional no Playwright; testes de `AppointmentService` / overlap sem browser.

### Frontend

Quase tudo é Client Component + `fetch` no browser. Sem Server Actions, cache do App Router nem RSC para dados. Adequado ao tamanho atual; vira custo de bundle e flicker de loading se a área logada crescer.

Playwright não roda viewport mobile; o layout do cliente é mobile-first e só se prova à mão.
