# Sistema de Agendamentos

Monorepo: frontend na **Vercel**, API e PostgreSQL no **Railway**. Para desenvolver, use o **ambiente Docker**: ele tem Postgres próprio e não precisa de nenhuma credencial de produção.

Documentação técnica completa (funcionalidades, arquitetura, API, dependências e infra): [docs/aplicacao.md](docs/aplicacao.md).

## Onde está cada parte

| Camada | Host             | URL                                        |
| ------ | ---------------- | ------------------------------------------ |
| Web    | Vercel           | https://agendamento.mefelipe.com.br        |
| API    | Railway          | https://api-production-ac23.up.railway.app |
| Banco  | Railway Postgres | acessado só pela API (rede privada)        |

O browser chama a API (`NEXT_PUBLIC_API_URL`). A API é quem conecta no Postgres.

## Começando (Docker, isolado da produção)

Pré-requisitos: Docker com Compose, Node.js >= 20 e npm >= 10 (para os testes).

Web, API e um Postgres próprio em containers. Não usa o `apps/api/.env` nem o banco do Railway: seed e testes mexem só no banco do container.

```bash
npm install
cp .env.example .env          # na raiz: preencher POSTGRES_PASSWORD, JWT_SECRET e SEED_PASSWORD
docker compose up -d --build --wait
docker compose run --rm seed  # dados fictícios: admin, cliente, profissionais, produtos e agendas
```

- Frontend: http://localhost:3000 · API: http://localhost:3001 · Swagger: http://localhost:3001/api/docs
- Postgres do container: `127.0.0.1:5434`
- As migrations rodam no serviço `migrate` antes de a API subir.
- O seed cria `admin@leemia.dev` (ADMIN), `cliente@leemia.dev` e os profissionais `*@leemia.dev`, todos com a senha de `SEED_PASSWORD` (sem ela, o seed sorteia uma e mostra no fim). Endereços `@leemia.dev` nunca recebem e-mail.
- `docker compose down` para tudo; `docker compose down -v` apaga também o banco.
- E-mail (Resend) e upload de foto (S3) ficam desligados até as chaves serem preenchidas no `.env`. Sem Resend, uma conta nova criada em `/register` fica sem o link de confirmação de e-mail e não reserva: use as contas do seed.

## Seed, testes E2E e o banco de produção

Seed e E2E apagam e sobrescrevem dados. Os dois se recusam a rodar quando a conexão parece ser a de produção: host do Railway, banco chamado `railway`, porta `5433` do túnel ou `NODE_ENV=production` (`apps/api/src/lib/database-guard.ts`).

O túnel (`npm run db:tunnel`, Railway CLI) abre o Postgres de **produção** em `127.0.0.1:5433`. Use só para consultas pontuais; nunca rode `npm run dev` apontando para ele.

Testes: [e2e/README.md](e2e/README.md).

## Comandos

```bash
docker compose up -d --build --wait   # web + API + Postgres local
docker compose run --rm seed          # dados fictícios no Postgres do container
npm run dev                           # API + web com hot reload (apps/api/.env no Postgres do Docker)
npm test                              # testes unitários da API
npm run test:e2e                      # E2E contra o Docker (veja e2e/README.md)
npm run build
npm run lint
npm run format
npm run db:tunnel                     # túnel para o Postgres de PRODUÇÃO (:5433), só leitura
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
