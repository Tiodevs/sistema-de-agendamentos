# Sistema de Agendamentos

Monorepo: frontend na **Vercel**, API e PostgreSQL no **Railway**. Local e produção usam o **mesmo banco**.

Documentação técnica completa (funcionalidades, arquitetura, API, dependências e infra): [docs/aplicacao.md](docs/aplicacao.md).

## Onde está cada parte

| Camada | Host             | URL                                                             |
| ------ | ---------------- | --------------------------------------------------------------- |
| Web    | Vercel           | https://agendamento.mefelipe.com.br                             |
| API    | Railway          | https://api-production-ac23.up.railway.app                      |
| Banco  | Railway Postgres | acessado só pela API (produção: rede privada; local: túnel SSH) |

O browser chama a API (`NEXT_PUBLIC_API_URL`). A API é quem conecta no Postgres.

## Começando (local = mesmo Postgres de produção)

Pré-requisitos: Node.js >= 20, npm >= 10, Railway CLI autenticado.

```bash
npm install
cp apps/api/.env.example apps/api/.env

# Terminal 1 — túnel para o Postgres do Railway (deixar aberto)
npm run db:tunnel

# Terminal 2 — dados fictícios (admin, profissionais, produtos, agendas)
npm run db:seed

# Terminal 3
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs

Sem o túnel, a API local não alcança o banco (`ECONNREFUSED` em `127.0.0.1:5433`).

## Comandos

```bash
npm run dev          # API + web
npm run dev:api      # só API (:3001)
npm run dev:web      # só web (:3000)
npm run db:tunnel    # túnel SSH do Postgres Railway → :5433
npm run db:seed      # popular o banco com dados fictícios
npm run build
npm run lint
npm run format
```

## Stack

| Camada    | Tecnologia                                         |
| --------- | -------------------------------------------------- |
| Backend   | Node.js, Express, TypeScript, Prisma 7, PostgreSQL |
| Frontend  | Next.js 15, React 19, Tailwind                     |
| Monorepo  | npm workspaces                                     |
| Qualidade | ESLint, Prettier, Husky                            |

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
