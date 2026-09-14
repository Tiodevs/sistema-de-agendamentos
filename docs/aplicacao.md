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

- Cadastro de cliente (`USER`) com nome, e-mail, senha (mín. 6) e telefone opcional. Envia e-mail de boas-vindas (Resend).
- Login com JWT (`Bearer`), validade configurável (`JWT_EXPIRES_IN`, padrão 7 dias).
- Sessão no browser via `localStorage` (`token` + `user`); validação com `GET /api/auth/me`.
- Redirecionamento pós-login por papel: admin → `/admin`, profissional → `/professional`, cliente → `/`.
- Logout local (remove token; o JWT não é invalidado no servidor).
- Contas podem ser desativadas (`active = false`); login recusa conta inativa e o `authMiddleware` consulta `active` de novo a cada request.
- Senha armazenada com bcrypt (custo 12).
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
- Cancelamento apenas dos próprios agendamentos futuros em `SCHEDULED`/`CONFIRMED` (dispara e-mail de cancelamento).
- Layout mobile-first (nav inferior, largura máx. ~`lg`).

### Área administrativa

- Dashboard: produtos/funcionários ativos, clientes, agenda do mês, receita, variação vs mês anterior, agenda de hoje, breakdown por status, top serviços e top profissionais, últimos agendamentos.
- CRUD de produtos/serviços (nome, descrição, preço, duração em minutos).
- Ativar/desativar produto sem apagar histórico.
- CRUD de funcionários (nome, e-mail, telefone, avatar).
- Ativar/desativar funcionário.
- Vincular funcionário a um `User` existente **pelo mesmo e-mail**; nesse caso o `role` vira `EMPLOYEE`.
- Atribuir quais serviços cada profissional realiza (`employee_products`).
- Agenda geral: filtrar, criar agendamento para qualquer cliente, mudar status, excluir.
- Configurar expediente por dia da semana (abre/fecha ou fechado).
- Dias especiais / feriados (fechado ou horário alternativo).
- Layout com sidebar (desktop) e sheet (mobile).

### Área do profissional

- Acesso só se existir `Employee` com `userId` = usuário logado e `active = true`.
- Dashboard próprio: agenda/receita do mês, variação, semana, concluídos, cancelados, clientes únicos, top serviços, agenda de hoje.
- Agenda filtrável por período e status.
- Atualizar status apenas para `CONFIRMED`, `IN_PROGRESS` ou `COMPLETED` (não cancela nem marca no-show por essa API).
- Só altera agendamentos em que é o profissional.

### Motor de agenda

- `endDate` = `date` + duração do produto.
- Conflito do profissional: intervalo `[date, endDate)` sobreposto a outro agendamento do mesmo profissional, ignorando `CANCELLED` e `NO_SHOW`. Trava `FOR UPDATE` + constraint `EXCLUDE` no Postgres.
- O mesmo cliente **pode** ter dois agendamentos no mesmo horário com profissionais diferentes.
- Reserva fora da grade (passado, fechado, desalinhado, estouro de expediente) é recusada no `create`.
- Profissional precisa estar vinculado ao produto.
- Produto e profissional precisam estar ativos.
- Horário do dia: `business_hours` + override de `special_days` (data civil UTC).
- Domingo padrão fechado; sábados 08:00–12:00; seg–sex 08:00–18:00 (seed / default da API).
- Status: `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.

### Operação e qualidade

- Health check `GET /api/health`.
- OpenAPI/Swagger gerado das JSDoc nas rotas.
- Validação de payload com Zod.
- Helmet + CORS restrito à origem do front + Morgan na API.
- Seed idempotente (`npm run db:seed`).
- Migrations Prisma em deploy (`prisma migrate deploy`).

### O que a aplicação **não** faz hoje

- Pagamento, WhatsApp ou SMS.
- Refresh token / logout server-side / 2FA.
- Upload real de avatar (campo existe, sem storage).
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

JWT payload: `{ id, email, role }`. Segredo: `JWT_SECRET`. **Local e Railway usam segredos diferentes** — o mesmo login/senha vale nos dois (mesmo `users`), mas o token de um ambiente não vale no outro.

Guards no cliente (layouts):

- Sem sessão → `/login`.
- `ADMIN` em rota de cliente → `/admin`.
- Profissional: `role === 'EMPLOYEE'` **ou** `employeeId` preenchido.

---

## 4. Como cada módulo funciona

### 4.1 Autenticação

1. `POST /api/auth/register` valida Zod, recusa e-mail duplicado, grava hash bcrypt, devolve user + token.
2. `POST /api/auth/login` busca por e-mail, checa `active`, `bcrypt.compare`, anexa `employeeId` se houver vínculo.
3. Cliente: `useAuth` persiste token; `apiRequest` injeta `Authorization`.
4. `authMiddleware` recusa ausência de header, formato inválido ou JWT inválido/expirado.

Arquivos: `apps/api/src/services/auth.service.ts`, `apps/web/src/hooks/use-auth.tsx`, `apps/web/src/lib/api.ts`.

### 4.2 Catálogo (produtos)

Produto = serviço vendável (`duration` em minutos, `price` decimal 10,2). Admin cria/edita; `toggle` inverte `active`. Cliente e fluxo de slots só veem ativos. Exclusão física existe na API (cuidado com FKs de agendamentos).

### 4.3 Profissionais

`Employee` é a entidade da agenda; `User` é a conta de login. Ligação opcional `employees.userId` (único). Sem vínculo, o profissional existe na agenda mas não entra em `/professional`.

`assignProducts` apaga N:N antigo e recria (substituição total).

### 4.4 Disponibilidade e reserva

`GET /api/appointments/availability?employeeId&productId&date=YYYY-MM-DD`:

1. Valida produto ativo, profissional ativo e vínculo.
2. Resolve horário do dia (`ScheduleService.getHoursForDate`).
3. Se fechado, `slots: []` e `isClosed: true`.
4. Gera slots de `openTime` até `closeTime` em passos de 15 min, cada um com duração do serviço.
5. Marca indisponível se passou ou se o intervalo cruza outro agendamento.

Cliente reserva com `POST /api/appointments/book` — o `clientId` é **sempre** o do token (não aceita agendar em nome de outro) e o papel precisa ser `USER`. Admin usa `POST /api/appointments` com `clientId` explícito. O `create` valida a mesma grade da disponibilidade e serializa reservas do mesmo profissional.

### 4.5 Expediente

`business_hours.dayOfWeek`: 0 = domingo … 6 = sábado. Se a tabela estiver vazia, `getBusinessHours()` materializa o default.

`special_days.date` (tipo `Date`, sem hora): feriado fechado ou expediente excepcional.

### 4.6 Dashboards

Agregações Prisma no mês civil do **relógio do servidor** (Railway em `us-east4`). Receita soma `price` de status `SCHEDULED|CONFIRMED|IN_PROGRESS|COMPLETED`. Cancelados/no-show entram no breakdown, não na receita nem na contagem “do mês” principal.

---

## 5. Modelo de dados

Prisma 7: `provider = postgresql` no schema; URL só em `prisma.config.ts` / `DATABASE_URL`. Client via `@prisma/adapter-pg` + `pg` (`apps/api/src/config/database.ts`). Neon foi removido.

| Tabela              | Função                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `users`             | login: `email` único, `password`, `role`, `active`                                            |
| `products`          | serviços                                                                                      |
| `employees`         | profissionais; `userId` opcional                                                              |
| `employee_products` | N:N profissional ↔ serviço                                                                    |
| `appointments`      | reserva; índices `(employeeId, date)`, `clientId`, `date`; exclude de overlap do profissional |
| `business_hours`    | expediente semanal (`dayOfWeek` único)                                                        |
| `special_days`      | exceções por data                                                                             |

Migrations em `apps/api/prisma/migrations/` (inclui `employees.userId`). Deploy: `prisma migrate deploy` no `preDeployCommand` do Railway.

---

## 6. API HTTP

Base `/api`. JSON `{ status, message?, data?, errors? }`. Erros de domínio: `statusCode` no `Error`. Zod 400 com `errors[]`. Stack só se `NODE_ENV=development`.

| Método                              | Rota                                    | Quem                                           | Função            |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------- | ----------------- |
| GET                                 | `/health`                               | público                                        | liveness          |
| GET                                 | `/docs`                                 | não-prod / flag                                | Swagger UI        |
| POST                                | `/auth/register`                        | público + rate                                 | cadastro          |
| POST                                | `/auth/login`                           | público + rate                                 | login             |
| GET                                 | `/auth/me`                              | token                                          | perfil            |
| GET                                 | `/auth/clients`                         | admin                                          | busca clientes    |
| CRUD + toggle                       | `/products`                             | mutações admin; `includeInactive` só admin     | catálogo          |
| CRUD + toggle + `PUT /:id/products` | `/employees`                            | mutações admin; listagem USER sem PII          | equipe            |
| GET                                 | `/appointments/availability`            | token                                          | slots             |
| GET                                 | `/appointments/my`                      | token                                          | do cliente        |
| POST                                | `/appointments/book`                    | USER + rate                                    | reserva própria   |
| PATCH                               | `/appointments/:id/cancel`              | dono, futuro                                   | cancelar próprio  |
| GET/POST/PATCH/DELETE               | `/appointments`                         | GET e mutações admin; GET `/:id` dono ou admin | gestão            |
| GET/PUT                             | `/schedule/business-hours`              | PUT admin                                      | expediente        |
| CRUD                                | `/schedule/special-days`                | mutações admin                                 | feriados          |
| GET                                 | `/dashboard/stats`                      | admin                                          | métricas          |
| GET                                 | `/professional/dashboard`               | profissional                                   | métricas próprias |
| GET                                 | `/professional/appointments`            | profissional                                   | agenda própria    |
| PATCH                               | `/professional/appointments/:id/status` | profissional                                   | status permitido  |

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

Variáveis da API no Railway: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `NODE_ENV=production`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `RAILPACK_NODE_VERSION=20`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `EMAIL_ASSET_BASE_URL`.

Remetente: `Leemia <agendamentos@mefelipe.com.br>` no domínio verificado `mefelipe.com.br` (região Resend `sa-east-1`). Templates HTML em `apps/api/src/emails/`, imagens em `apps/web/public/email/` e `apps/api/emails/static/`. O envio não bloqueia a API: falha de e-mail é só logada. Endereços `*@leemia.dev` (seed) são ignorados para não gerar bounce.

Build Railway: `npm ci && npm run build --workspace=api`. Start: `npm run start --workspace=api`. Pre-deploy: `npm exec --workspace=api -- prisma migrate deploy`.

---

## 10. Rodar localmente e seed

```bash
npm install
npm run db:tunnel    # terminal 1 — obrigatório
npm run db:seed      # opcional; grava no Postgres de produção
npm run dev          # API :3001 + web :3000
```

Seed (`apps/api/prisma/seed.ts`):

- Promove `agedamentos.admin.felipe@gmail.com` a `ADMIN` (não altera senha).
- Mantém `agendamento.felipe@gmail.com` como `USER`.
- Cria profissionais `*@leemia.dev`, produtos, expediente, Natal fechado, 9 agendamentos `[seed]`.
- Senha das contas **fictícias**: `Senha@123`.

Como local = produção no banco, o seed aparece no site publicado.

Migrations: `cd apps/api && npx prisma migrate deploy`.

Deploy API: `railway up --service api -m "…"`. Deploy web: git/Vercel.

---

## 11. Convenções

[Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Husky + lint-staged (Prettier/ESLint) no commit.
