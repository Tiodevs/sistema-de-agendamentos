# Documentação técnica — Sistema de Agendamentos

Sistema para estúdios/salões (marca **Leemia** na UI): clientes marcam serviços com profissionais, o admin opera o catálogo e a agenda, e o profissional acompanha os próprios atendimentos.

Repositório: [Tiodevs/sistema-de-agendamentos](https://github.com/Tiodevs/sistema-de-agendamentos).

| Camada  | Onde                                         | URL                                                 |
| ------- | -------------------------------------------- | --------------------------------------------------- |
| Web     | Vercel, projeto `sistema-de-agendamento-web` | https://agendamento.mefelipe.com.br                 |
| API     | Railway, serviço `api`                       | https://api-production-ac23.up.railway.app          |
| Banco   | Railway Postgres 18                          | só a API acessa                                     |
| Swagger | Railway                                      | https://api-production-ac23.up.railway.app/api/docs |

---

## 1. Lista de funcionalidades

### Autenticação e contas

- Cadastro de cliente (`USER`) com nome, e-mail, senha (mín. 8, com letra maiúscula e caractere especial) e telefone opcional. A conta já entra, mas só reserva depois de confirmar o e-mail pelo link (24 h, `POST /api/auth/verify-email/resend` reenvia). O e-mail de boas-vindas vai depois da confirmação. Contas anteriores a essa regra ficaram confirmadas na migration. Contas antigas continuam podendo entrar com a senha que já tinham.
- Login com JWT (`Bearer`, `alg=HS256`), validade configurável (`JWT_EXPIRES_IN`, padrão 12 horas). Payload: `{ id, email, role, tv }`.
- Sessão no browser via `localStorage` (`token` + `user`); validação com `GET /api/auth/me`. `POST /api/auth/logout` incrementa `tokenVersion` e derruba todas as sessões da conta.
- Redirecionamento pós-login por papel: admin → `/admin`, profissional → `/professional`, cliente → `/`.
- Troca de e-mail no perfil exige confirmação pelo link enviado ao endereço novo; o e-mail atual só muda depois disso.
- Contas podem ser desativadas (`active = false`); login responde a mesma `401` de credencial inválida (com hash dummy) para não enumerar contas.
- Senha armazenada com bcrypt (custo 12). Login de contas antigas não exige a política nova.
- Listagem/busca de clientes restrita a admin (`GET /api/auth/clients`).

### Área do cliente

- Home com resumo dos próprios agendamentos.
- Fluxo de agendamento em 3 passos: serviço → profissional (só quem atende o serviço) → data/horário. Só `USER`; profissional/admin são redirecionados.
- Grade de slots gerada a cada 15 minutos, no fuso `America/Sao_Paulo`.
- Slots no passado, em conflito ou em dia fechado aparecem indisponíveis; o calendário desabilita domingo/feriado/dia fechado.
- A API recusa o mesmo horário se ele não existir na grade (passado, expediente, alinhamento, fechamento).
- Observação opcional no agendamento.
- Preço congelado no momento da reserva (cópia do preço do produto).
- E-mail de confirmação ao cliente e aviso ao profissional na criação do agendamento.
- Lista “Meus horários”.
- Cancelamento apenas dos próprios agendamentos em `SCHEDULED`/`CONFIRMED`, até a antecedência mínima (`CANCELLATION_NOTICE_HOURS`, padrão 2 h). Cada agendamento traz `cancellableUntil`; depois do prazo, só o estúdio cancela. Cancelar avisa o cliente e o profissional por e-mail.
- Layout mobile-first (nav inferior, largura máx. ~`lg`).

### Área administrativa

- Dashboard: produtos/funcionários ativos, clientes, agenda do mês, receita, variação vs mês anterior, agenda de hoje, breakdown por status, top serviços e top profissionais, últimos agendamentos.
- CRUD de produtos/serviços (nome, descrição, preço, duração em minutos).
- Ativar/desativar produto sem apagar histórico. Serviço com agendamentos no histórico não é excluído (`409 HAS_APPOINTMENTS`): o caminho é desativar.
- CRUD de funcionários (nome, e-mail, telefone, avatar). Profissional com histórico não é excluído (`409 HAS_APPOINTMENTS`).
- Ativar/desativar funcionário. Desativar quem tem horários futuros pede decisão (ver “Mudanças que afetam a agenda”).
- Acesso ao painel do profissional por **convite**: cadastrar o profissional envia um link (7 dias) ao e-mail dele e não liga nem promove nenhuma conta. O vínculo só acontece em `/accept-invite`, quando o dono do e-mail aceita: entrando na conta que já tem (com a senha dela) ou criando a senha. O admin vê o estado do acesso (com acesso, convite pendente, expirado, sem acesso), reenvia o convite (`POST /api/employees/{id}/invite`) e remove o acesso (`DELETE /api/employees/{id}/access`, que devolve a conta ao papel `USER`).
- Atribuir quais serviços cada profissional realiza (`employee_products`).
- Agenda geral: filtrar, criar agendamento para qualquer cliente e mudar status pela máquina de estados (o menu mostra só `allowedStatuses`; cancelar e registrar falta pedem confirmação; “Desfazer” por 10 minutos). Agendamentos não são excluídos (`DELETE` responde `409 APPOINTMENT_DELETE_DISABLED`): o caminho é cancelar.
- Configurar expediente por dia da semana (abre/fecha ou fechado). A semana é gravada numa transação só. O expediente padrão é criado pela migration; o `GET` não grava nada.
- Dias especiais / feriados (fechado ou horário alternativo).
- Personalizar expediente e folgas por profissional (o padrão é o do estabelecimento; feriado do estúdio continua valendo para todos).

### Mudanças que afetam a agenda

Fechar um dia, criar horário especial, mudar o expediente (do estúdio ou do profissional), voltar ao horário do estúdio, remover um dia especial ou desativar um profissional olham os agendamentos marcados ou confirmados que ficariam sem atendimento. Sem decisão, a API responde `409 AFFECTED_APPOINTMENTS` com a lista em `details.appointments` e não salva nada. A tela mostra os afetados e repete o pedido com `?onAffected=keep` (salva e mantém) ou `?onAffected=cancel` (salva, cancela na mesma transação e avisa cada cliente por e-mail, com o motivo). A resposta traz `impact: { affected, cancelled }`.

- Layout com sidebar (desktop) e sheet (mobile).

### Área do profissional

- Acesso só se existir `Employee` com `userId` = usuário logado e `active = true`.
- Dashboard próprio: agenda/receita do mês, variação, semana, concluídos, cancelados, clientes únicos, top serviços, agenda de hoje.
- Agenda filtrável por período e status.
- Atualiza status pela máquina de estados: confirma, inicia (a partir de 1 h antes), conclui e registra falta (depois do início) e cancela até a antecedência mínima, avisando o cliente. “Desfazer” por 10 minutos (`POST /api/professional/appointments/{id}/status/undo`).
- Só altera agendamentos em que é o profissional.

### Motor de agenda

- `endDate` = `date` + duração do produto.
- Conflito do profissional: intervalo `[date, endDate)` sobreposto a outro agendamento do mesmo profissional, ignorando `CANCELLED` e `NO_SHOW`. Trava `FOR UPDATE` + constraint `EXCLUDE` no Postgres.
- O mesmo cliente **pode** ter dois agendamentos no mesmo horário com profissionais diferentes.
- Reserva fora da grade (passado, fechado, desalinhado, estouro de expediente) é recusada no `create`.
- Profissional precisa estar vinculado ao produto.
- Produto e profissional precisam estar ativos.
- Horário do dia: `business_hours` + override de `special_days` (data civil UTC), intersectado com expediente/folga do profissional quando houver.
- Domingo padrão fechado; sábados 08:00–12:00; seg–sex 08:00–18:00 (migration `20261108120000_reliable_schedule`, que só grava com a tabela vazia).
- Status: `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Máquina de estados única (`apps/api/src/lib/appointment-status.ts`) para admin, profissional e cliente. `COMPLETED`, `CANCELLED` e `NO_SHOW` são finais; ninguém volta para `SCHEDULED`. Concluir e registrar falta só depois do início; iniciar a partir de 1 h antes. Cliente e profissional cancelam até `CANCELLATION_NOTICE_HOURS` antes; o admin, a qualquer momento. Transição inválida responde `409` (ou `403` para papel sem permissão) com `code` (`FINAL_STATUS`, `INVALID_TRANSITION`, `TOO_EARLY`, `CANCELLATION_WINDOW_CLOSED`, `STATUS_CHANGED`).
- Toda mudança de status fica em `appointment_status_changes` (de, para, papel, quem e motivo). A última mudança pode ser desfeita por quem a fez em até 10 minutos, exceto cancelamento.

### Operação e qualidade

- Health check `GET /api/health`.
- OpenAPI/Swagger gerado das JSDoc nas rotas.
- Validação de payload com Zod.
- Helmet + CORS restrito à origem do front + Morgan na API.
- Seed idempotente (`npm run db:seed`).
- Migrations Prisma em deploy (`prisma migrate deploy`).

### O que a aplicação **não** faz hoje

- Pagamento, WhatsApp ou SMS.
- Refresh token / cookie `httpOnly` / 2FA.
- Rate limit distribuído (Redis) e CAPTCHA após N falhas de login.
- Multi-empresa / multi-tenant.
- Fila, cache Redis ou filas de job.
- Testes automatizados.
- API ligada ao GitHub (deploy da API é upload/`railway up`).

---

## 2. Arquitetura

Monorepo npm workspaces:

```
agendamentos/
├── apps/api/     Express + TypeScript + Prisma 7
├── apps/web/     Next.js 15 App Router + React 19
├── packages/     reservado
└── docs/
```

```
┌─────────────┐     HTTPS / fetch      ┌──────────────┐     TCP      ┌────────────┐
│ Browser     │  NEXT_PUBLIC_API_URL   │ API Express  │  Prisma+pg  │ PostgreSQL │
│ Next.js SPA │ ─────────────────────► │ :3001 / Rail │ ──────────► │ Railway    │
│ (Vercel)    │     Bearer JWT         │              │             │            │
└─────────────┘                        └──────────────┘             └────────────┘
```

O frontend **não** conecta no banco. Toda regra de negócio está na API (`controllers` → `services` → Prisma).

**Produção:** Vercel (root `apps/web`) → `https://api-production-ac23.up.railway.app` → `postgres.railway.internal:5432`.

**Local:** Next `:3000` → API `:3001` → túnel `127.0.0.1:5433` → o **mesmo** Postgres. Sem túnel (`npm run db:tunnel`) a API falha com `Can't reach database server at 127.0.0.1:5433`.

O proxy público Railway (`*.proxy.rlwy.net`) existe, mas nesta rede costuma falhar (`EBADF`). O túnel SSH é o caminho suportado.

---

## 3. Papéis e autorização

| Papel      | Como nasce                                            | UI                                       | API                                                |
| ---------- | ----------------------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `USER`     | `/register`                                           | `/(user)`: `/`, `/book`, `/appointments` | agenda própria                                     |
| `ADMIN`    | promoção no banco / seed                              | `/admin/*`                               | middlewares `auth` + `admin`                       |
| `EMPLOYEE` | admin cria funcionário com e-mail de um user, ou seed | `/professional/*`                        | `auth` + `professional` (exige `employees.userId`) |

JWT payload: `{ id, email, role, tv }`. Segredo: `JWT_SECRET`. Algoritmo fixo `HS256`. **Local e Railway usam segredos diferentes** — o mesmo login/senha vale nos dois (mesmo `users`), mas o token de um ambiente não vale no outro.

Guards no cliente (layouts):

- Sem sessão → `/login`.
- `ADMIN` em rota de cliente → `/admin`.
- Profissional: `role === 'EMPLOYEE'` **ou** `employeeId` preenchido.

---

## 4. Como cada módulo funciona

### 4.1 Autenticação

1. `POST /api/auth/register` valida Zod (senha com maiúscula + especial), recusa e-mail duplicado, grava hash bcrypt, gera o link de confirmação do e-mail e devolve user (`emailVerified: false`) + token.
2. `POST /api/auth/login` busca por e-mail, compara senha (hash dummy se a conta não existir), trata inativa como credencial inválida, anexa `employeeId` se houver vínculo. Cinco falhas em 15 min bloqueiam o par **e-mail + IP** por 15 min (memória do processo): outro IP continua entrando, o reset de senha libera a conta e a resposta diz o horário (`429`, `code: LOGIN_LOCKED`).
3. Cliente: `useAuth` persiste token; `apiRequest` injeta `Authorization`. `Sair` chama `POST /api/auth/logout` e limpa o storage.
4. `authMiddleware` recusa ausência de header, formato inválido, JWT inválido/expirado, `tv` diferente de `tokenVersion`, ou `iat` anterior a `passwordChangedAt`.
5. `PATCH /api/auth/profile` atualiza nome/telefone na hora. E-mail novo gera token (hash SHA-256, 30 min) e só entra após `POST /api/auth/confirm-email`. O mesmo endpoint confirma o e-mail do cadastro e marca `emailVerifiedAt`.
6. Reset de senha: o e-mail aponta para `/reset-password#token=...` (fragmento, não query). Como o link chegou no e-mail da conta, o reset também marca o e-mail como confirmado e libera o bloqueio de login.

Arquivos: `apps/api/src/services/auth.service.ts`, `apps/web/src/hooks/use-auth.tsx`, `apps/web/src/lib/api.ts`.

### 4.2 Catálogo (produtos)

Produto = serviço vendável (`duration` em minutos, `price` decimal 10,2). Admin cria/edita; `toggle` inverte `active`. Cliente e fluxo de slots só veem ativos. Exclusão física existe na API (cuidado com FKs de agendamentos).

### 4.3 Profissionais

`Employee` é a entidade da agenda; `User` é a conta de login. Ligação opcional `employees.userId` (único). Sem vínculo, o profissional existe na agenda mas não entra em `/professional`.

`assignProducts` apaga N:N antigo e recria (substituição total).

### 4.4 Disponibilidade e reserva

`GET /api/appointments/availability?employeeId&productId&date=YYYY-MM-DD`:

1. Valida produto ativo, profissional ativo e vínculo.
2. Resolve horário do dia (`ScheduleService.getHoursForDate` com o `employeeId`): expediente do estúdio, depois o do profissional, e a interseção dos dois.
3. Se fechado, `slots: []` e `isClosed: true`.
4. Gera slots de `openTime` até `closeTime` em passos de 15 min, cada um com duração do serviço.
5. Marca indisponível se passou ou se o intervalo cruza outro agendamento.

Cliente reserva com `POST /api/appointments/book` — o `clientId` é **sempre** o do token (não aceita agendar em nome de outro) e o papel precisa ser `USER`. Admin usa `POST /api/appointments` com `clientId` explícito. O `create` valida a mesma grade da disponibilidade e serializa reservas do mesmo profissional.

Na reserva do próprio cliente (`apps/api/src/lib/booking-rules.ts`): e-mail confirmado (`403 EMAIL_NOT_VERIFIED`), no máximo 3 agendamentos futuros marcados ou confirmados (`409 BOOKING_LIMIT_REACHED`, contado com a linha do cliente travada) e até 60 dias de antecedência (`400 BOOKING_TOO_FAR`). Limite de 30 pedidos por hora por usuário. O admin não passa por essas regras. Cada destinatário recebe no máximo 50 e-mails por dia (5 de confirmação, 10 de reset).

### 4.5 Expediente

`business_hours.dayOfWeek`: 0 = domingo … 6 = sábado. Se a tabela estiver vazia, `getBusinessHours()` materializa o default.

`special_days.date` (tipo `Date`, sem hora): feriado fechado ou expediente excepcional.

`employee_business_hours` / `employee_special_days`: se o profissional não tiver linhas, herda o estúdio. Folga própria fecha só aquele profissional. Estúdio fechado fecha todo mundo.

### 4.6 Dashboards

Agregações Prisma no mês civil do **relógio do servidor** (Railway em `us-east4`). Receita soma `price` de status `SCHEDULED|CONFIRMED|IN_PROGRESS|COMPLETED`. Cancelados/no-show entram no breakdown, não na receita nem na contagem “do mês” principal.

---

## 5. Modelo de dados

Prisma 7: `provider = postgresql` no schema; URL só em `prisma.config.ts` / `DATABASE_URL`. Client via `@prisma/adapter-pg` + `pg` (`apps/api/src/config/database.ts`). Neon foi removido.

| Tabela                    | Função                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `users`                   | login: `email` único, `password`, `role`, `active`                                            |
| `products`                | serviços                                                                                      |
| `employees`               | profissionais; `userId` opcional                                                              |
| `employee_products`       | N:N profissional ↔ serviço                                                                    |
| `appointments`            | reserva; índices `(employeeId, date)`, `clientId`, `date`; exclude de overlap do profissional |
| `business_hours`          | expediente semanal do estúdio (`dayOfWeek` único)                                             |
| `special_days`            | exceções por data do estúdio                                                                  |
| `employee_business_hours` | expediente semanal opcional por profissional (`employeeId` + `dayOfWeek`)                     |
| `employee_special_days`   | folga ou horário especial por profissional e data                                             |

Migrations em `apps/api/prisma/migrations/` (inclui `employees.userId`). Deploy: `prisma migrate deploy` no `preDeployCommand` do Railway.

---

## 6. API HTTP

Base `/api`. JSON `{ status, message?, data?, errors? }`. Erros de domínio: `statusCode` no `Error`. Zod 400 com `errors[]`. Stack só se `NODE_ENV=development`.

| Método                              | Rota                                    | Quem                                           | Função                             |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------- | ---------------------------------- |
| GET                                 | `/health`                               | público                                        | liveness                           |
| GET                                 | `/docs`                                 | não-prod / flag                                | Swagger UI                         |
| POST                                | `/auth/register`                        | público + rate                                 | cadastro                           |
| POST                                | `/auth/login`                           | público + rate                                 | login                              |
| GET                                 | `/auth/me`                              | token                                          | perfil                             |
| POST                                | `/auth/verify-email/resend`             | token + rate                                   | reenvia confirmação do e-mail      |
| GET                                 | `/auth/clients`                         | admin                                          | busca clientes                     |
| CRUD + toggle                       | `/products`                             | mutações admin; `includeInactive` só admin     | catálogo                           |
| CRUD + toggle + `PUT /:id/products` | `/employees`                            | mutações admin; listagem USER sem PII          | equipe                             |
| GET                                 | `/appointments/availability`            | token                                          | slots                              |
| GET                                 | `/appointments/my`                      | token                                          | do cliente                         |
| POST                                | `/appointments/book`                    | USER + rate                                    | reserva própria                    |
| PATCH                               | `/appointments/:id/cancel`              | dono, futuro                                   | cancelar próprio                   |
| GET/POST/PATCH/DELETE               | `/appointments`                         | GET e mutações admin; GET `/:id` dono ou admin | gestão                             |
| GET/PUT                             | `/schedule/business-hours`              | PUT admin                                      | expediente                         |
| CRUD                                | `/schedule/special-days`                | mutações admin                                 | feriados                           |
| GET                                 | `/schedule/employees`                   | admin                                          | resumo por profissional            |
| GET                                 | `/schedule/employees/:employeeId`       | token                                          | expediente efetivo                 |
| PUT/DELETE                          | `/schedule/employees/:id/hours`         | admin                                          | horário próprio / voltar ao padrão |
| POST/PUT/DELETE                     | `/schedule/employees/:id/special-days`  | admin                                          | folga do profissional              |
| GET                                 | `/dashboard/stats`                      | admin                                          | métricas                           |
| GET                                 | `/professional/dashboard`               | profissional                                   | métricas próprias                  |
| GET                                 | `/professional/appointments`            | profissional                                   | agenda própria                     |
| PATCH                               | `/professional/appointments/:id/status` | profissional                                   | status permitido                   |

Swagger: JSDoc em `apps/api/src/routes/*.ts`. O `servers` do spec ainda cita `http://localhost:3001`.

---

## 7. Frontend

Next.js 15 App Router, quase tudo **Client Components** (`'use client'`). Dados via `fetch` no browser, não via Server Actions / Route Handlers.

| Rota                                                                                                                 | Função       |
| -------------------------------------------------------------------------------------------------------------------- | ------------ |
| `/login`, `/register`                                                                                                | auth         |
| `/`, `/book`, `/appointments`                                                                                        | cliente      |
| `/admin`, `/admin/appointments`, `/admin/appointments/new`, `/admin/employees`, `/admin/products`, `/admin/schedule` | admin        |
| `/professional`, `/professional/agenda`                                                                              | profissional |

`apps/web/src/lib/api.ts` encapsula a API. Tema dark fixo (`<html className="dark">`). UI: shadcn/ui (New York), Radix, Tailwind 4, Lucide, Sonner.

`next.config.ts` faz rewrite `/api/*` → `localhost:3001`. Em produção o cliente usa URL absoluta da Railway; esse rewrite **não** é o proxy de produção.

---

## 8. Dependências

### Root

`concurrently`, `husky`, `prettier`, `lint-staged`. Node `>= 20`.

### API (`apps/api`)

| Pacote                                 | Papel                      |
| -------------------------------------- | -------------------------- |
| `express`                              | HTTP                       |
| `prisma` / `@prisma/client`            | ORM + migrate              |
| `resend`                               | e-mail transacional        |
| `@prisma/adapter-pg` + `pg`            | driver Postgres (Prisma 7) |
| `bcryptjs`                             | hash de senha              |
| `jsonwebtoken`                         | JWT                        |
| `zod`                                  | validação                  |
| `cors`, `helmet`, `morgan`             | CORS, headers, access log  |
| `dotenv`                               | `.env`                     |
| `swagger-jsdoc` + `swagger-ui-express` | OpenAPI                    |
| `tsx`                                  | dev + seed                 |

Build: `prisma generate && tsc` → `dist/server.js`.

### Web (`apps/web`)

| Pacote                                               | Papel                         |
| ---------------------------------------------------- | ----------------------------- |
| `next` 15                                            | app, build Vercel             |
| `react` / `react-dom` 19                             | UI                            |
| `tailwindcss` 4                                      | estilo                        |
| `radix-ui` / `@radix-ui/react-slot`                  | primitivos                    |
| `class-variance-authority`, `clsx`, `tailwind-merge` | variantes                     |
| `lucide-react`                                       | ícones                        |
| `next-themes`                                        | tema (dark forçado no layout) |
| `sonner`                                             | toasts                        |
| `sass`                                               | `globals.scss` legado         |

Não há SDK Railway/Vercel no runtime da app: só HTTP + env.

---

## 9. Integrações e infraestrutura

Não há gateways de pagamento, WhatsApp, storage ou analytics de produto no código. Integrações reais:

| Integração               | Uso                                                                          |
| ------------------------ | ---------------------------------------------------------------------------- |
| **PostgreSQL (Railway)** | fonte da verdade                                                             |
| **Railway**              | API + Postgres + volume 5 GB, região `us-east4-eqdc4a`, health `/api/health` |
| **Vercel**               | Next, root `apps/web`, Node 24.x, `NEXT_PUBLIC_API_URL`                      |
| **Resend**               | e-mail transacional (boas-vindas, agendamento, cancelamento)                 |
| **GitHub**               | repo do frontend na Vercel; API **sem** `source.repo`                        |
| **Railway CLI**          | `railway up`, `railway connect` (túnel)                                      |
| **Prisma Migrate**       | schema no deploy                                                             |
| **OpenAPI/Swagger**      | documentação viva das rotas                                                  |

IDs:

- Vercel: `prj_xFnqJBiQizUqgYBLU0heytS37Jok`
- Railway projeto: `18f824b7-38e7-4b0f-9e22-82e7670fc492`
- Serviço `api`: `1e608ddf-d59c-4acf-b51f-6c287129d901`
- Serviço `Postgres`: `a092292a-4cfd-434d-8728-3da926636791`

Aliases web: `agendamento.mefelipe.com.br`, `sistema-de-agendamento-web.vercel.app`.

Variáveis da API no Railway: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `NODE_ENV=production`, `JWT_SECRET`, `JWT_EXPIRES_IN=12h` (se ainda estiver `7d`, vale a variável), `RAILPACK_NODE_VERSION=20`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `EMAIL_ASSET_BASE_URL`. Opcional: `CANCELLATION_NOTICE_HOURS` (padrão 2).

Remetente: `Leemia <agendamentos@mefelipe.com.br>` no domínio verificado `mefelipe.com.br` (região Resend `sa-east-1`). Templates HTML em `apps/api/src/emails/`, imagens em `apps/web/public/email/` e `apps/api/emails/static/`. O envio não bloqueia a API: falha de e-mail é só logada. Endereços `*@leemia.dev` (seed) são ignorados para não gerar bounce.

Build Railway: `npm ci && npm run build --workspace=api`. Start: `npm run start --workspace=api`. Pre-deploy: `npm exec --workspace=api -- prisma migrate deploy`.

---

## 10. Rodar localmente e seed

Ambiente Docker, com Postgres próprio (detalhes no [README](../readme.md)):

```bash
npm install
cp .env.example .env                 # POSTGRES_PASSWORD, JWT_SECRET e SEED_PASSWORD
docker compose up -d --build --wait  # web :3000, API :3001, Postgres :5434
docker compose run --rm seed         # opcional; grava só no Postgres do container
```

Seed (`apps/api/prisma/seed.ts`):

- Cria (ou devolve ao estado do seed) `admin@leemia.dev` como `ADMIN` e `cliente@leemia.dev` como `USER`. `SEED_ADMIN_EMAIL` e `SEED_CLIENT_EMAIL` promovem uma conta já cadastrada, sem mudar nome nem senha.
- Cria profissionais `*@leemia.dev`, produtos, expediente, Natal fechado, 9 agendamentos `[seed]`.
- Senha das contas fictícias: a de `SEED_PASSWORD`; sem ela, uma senha sorteada a cada execução, mostrada no fim.
- Todas as contas do seed saem com e-mail confirmado.
- Recusa rodar contra o Postgres de produção (`apps/api/src/lib/database-guard.ts`): host do Railway, banco `railway`, porta 5433 do túnel ou `NODE_ENV=production`.

Migrations: `cd apps/api && npx prisma migrate deploy`.

Deploy API: `railway up --service api -m "…"`. Deploy web: git/Vercel.

---

## 11. Convenções

[Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Husky + lint-staged (Prettier/ESLint) no commit.
