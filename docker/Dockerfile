# syntax=docker/dockerfile:1

# Monorepo (npm workspaces) com três alvos:
#   api        API Express compilada; a mesma imagem roda as migrations
#   api-build  API com as dependências de desenvolvimento; usada pelo seed
#   web        Next.js em modo standalone
#
# A versão do Node segue o .nvmrc e o Railway (RAILPACK_NODE_VERSION=20).
ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false
WORKDIR /app

# ---------- API ----------

# O Prisma olha o OpenSSL instalado para escolher o binário do schema engine (migrate).
FROM base AS api-base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
# O npm ci valida o lockfile contra todos os workspaces, então os package.json de todos entram.
# packages/contracts é só de tipos (o contrato entre a API e o web): entra inteiro, para o tsc.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts packages/contracts

FROM api-base AS api-build
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=apps/api
COPY apps/api apps/api
RUN npm run build --workspace=apps/api

FROM api-base AS api-prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=apps/api --omit=dev

FROM api-prod-deps AS api
ENV NODE_ENV=production \
    PORT=3001 \
    PATH=/app/node_modules/.bin:$PATH
WORKDIR /app/apps/api
COPY apps/api/prisma.config.ts ./
COPY apps/api/prisma ./prisma
RUN prisma generate
COPY apps/api/emails ./emails
# O swagger-jsdoc lê os comentários de ./src/routes/*.ts em tempo de execução.
COPY apps/api/src/routes ./src/routes
COPY --from=api-build /app/apps/api/dist ./dist
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]

# ---------- Web ----------

FROM base AS web-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts packages/contracts
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=apps/web

FROM web-deps AS web-build
# NEXT_PUBLIC_* entra no bundle durante o build: é a URL que o navegador usa para chamar a API.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_OUTPUT=standalone
COPY apps/web apps/web
RUN npm run build --workspace=apps/web

FROM base AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
