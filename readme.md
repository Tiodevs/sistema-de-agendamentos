# 📅 Sistema de Agendamentos

Sistema de agendamentos online — monorepo com backend e frontend.

## 🏗️ Arquitetura

```
agendamentos/
├── apps/
│   ├── api/          # Backend — Node.js + Express + TypeScript
│   └── web/          # Frontend — Next.js 15 + React 19 + SCSS
├── packages/         # Pacotes compartilhados (futuro)
├── .editorconfig
├── .prettierrc
├── .nvmrc
└── package.json      # Root — npm workspaces
```

## 🚀 Começando

### Pré-requisitos

- Node.js >= 20
- npm >= 10

### Instalação

```bash
# Clone o repositório
git clone <url-do-repo>
cd agendamentos

# Instale todas as dependências (root + workspaces)
npm install

# Copie os .env de exemplo
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### Rodando o projeto

```bash
# Rodar backend + frontend juntos
npm run dev

# Rodar apenas o backend (porta 3001)
npm run dev:api

# Rodar apenas o frontend (porta 3000)
npm run dev:web
```

### Build

```bash
# Build de tudo
npm run build

# Build individual
npm run build:api
npm run build:web
```

### Outros comandos

```bash
# Lint
npm run lint

# Formatar código
npm run format

# Verificar formatação
npm run format:check

# Limpar node_modules e builds
npm run clean
```

## 🛠️ Stack

| Camada   | Tecnologia                        |
| -------- | --------------------------------- |
| Backend  | Node.js, Express, TypeScript      |
| Frontend | Next.js 15, React 19, SCSS        |
| Monorepo | npm workspaces                    |
| Lint     | ESLint, Prettier                  |
| Git      | Husky, lint-staged                |

## 📡 Endpoints da API

| Método | Rota           | Descrição              |
| ------ | -------------- | ---------------------- |
| GET    | /api/health    | Health check           |
| GET    | /api/docs      | Documentação Swagger   |
| GET    | /api/docs.json | Swagger spec em JSON   |

## 📝 Convenções de Commits

Utilizamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — nova funcionalidade
- `fix:` — correção de bug
- `docs:` — documentação
- `style:` — formatação (sem mudança de lógica)
- `refactor:` — refatoração
- `test:` — testes
- `chore:` — tarefas de build/config