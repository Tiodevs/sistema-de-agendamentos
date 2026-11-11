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

Cada dia aceita até 4 pausas (almoço, intervalo), no estúdio e por profissional, e cada profissional pode ter um respiro em minutos entre dois atendimentos. Os horários dentro de uma pausa somem da grade, e criar uma pausa em cima de um horário marcado passa pela mesma pergunta de “agendamentos afetados”.

**Ainda falta:** pausa em dia especial (hoje o dia especial tem só abertura e fechamento) e respiro por serviço.

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

`/admin/clients` lista, busca e pagina os clientes no servidor, com a ficha e o histórico de cada um. O “novo agendamento” busca o cliente no servidor (qualquer cliente é encontrado) e cadastra na hora quem ligou e ainda não tem conta. Ainda não dá para desativar conta, promover a admin nem anotar preferências.

Papel `ADMIN` nasce no seed/banco. Criar funcionário com o **mesmo e-mail** de um `USER` vira `EMPLOYEE` sem tela de confirmação.

**Fazer:** desativar conta pela tela, promoção de papel explícita na UI e notas por cliente.

### Agenda administrativa é lista, não calendário

`/admin/appointments` é paginada pela API, abre em “a partir de hoje” e tem filtro de período, status e busca pelo cliente. `/professional/agenda` ainda carrega a coleção do profissional e filtra no browser. Sem visão semana/mês nem arrastar horário.

Com volume, a agenda do profissional e “Meus horários” (sem `take`) ainda viram problema.

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

O JWT ainda vai no `localStorage` e no JSON de login. O curto prazo já está feito: o web envia CSP, `frame-ancestors 'none'`, `Referrer-Policy` e `Permissions-Policy`, e o rewrite `/api/*` do Next aponta para a API por variável (`API_PROXY_URL`), que é a base do proxy same-origin. Logout e `tokenVersion` já derrubam **todas** as sessões da conta no servidor, mas XSS na origem continua lendo o Bearer. Não há sessão por dispositivo: um “Sair” invalida o celular e o computador juntos.

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
- Listagens grandes (`my`, agenda do profissional) sem paginação. A agenda do admin já é paginada.
- `packages/contracts` tem os tipos do que trafega em JSON (sessão, cliente, agendamento, disponibilidade) e a API confere o contrato em tempo de compilação. Os schemas Zod continuam só na API, e o resto do `lib/api.ts` do web (serviços, equipe, painel) ainda declara os próprios tipos.
- E-mails passam por uma fila no Postgres (`email_outbox`), com nova tentativa e envio agendado; o worker roda no processo da API. Falta o job de lembrete (D-1) e separar o worker quando houver mais de uma instância.

### Infra e operação

- Local e produção usam o **mesmo** Postgres (túnel SSH). Seed e E2E mexem em dado real. Isolar banco de dev/E2E.
- CI (`ci.yml`: build, testes, lint, contrato do banco e E2E) e deploy com aprovação (`deploy.yml`) em `.github/workflows`.
- Ajustar `JWT_EXPIRES_IN` no Railway para `12h` se a variável ainda estiver `7d` (o padrão do código já é 12h).
- Observabilidade: log estruturado (pino) com id de requisição e Sentry na API quando `SENTRY_DSN` está definido. Falta criar o projeto no Sentry e o alerta de taxa de 5xx, o Sentry no web e métricas de negócio.
- Backup/restore do Postgres não está documentado no repo (fica o que o Railway retém).

### Qualidade e testes

E2E cobre cliente (book + auth) com Chromium só. Quase não há UI/API de admin (CRUD, expediente, dashboard) nem do profissional (status). Sem testes unitários dos services.

Happy path de reset/confirmação de e-mail no E2E ainda depende da caixa `leemia.dev` (inserir hash no banco ou interceptar o provedor).

**Fazer:** Postgres de teste isolado; um fluxo admin + um fluxo profissional no Playwright; testes de `AppointmentService` / overlap sem browser.

### Frontend

Quase tudo é Client Component + `fetch` no browser. Sem Server Actions, cache do App Router nem RSC para dados. Adequado ao tamanho atual; vira custo de bundle e flicker de loading se a área logada crescer.

Playwright não roda viewport mobile; o layout do cliente é mobile-first e só se prova à mão.
