# syntax=docker/dockerfile:1.7

FROM node:24.18.0-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /workspace

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY infra/scripts/setup-git-hooks.mjs infra/scripts/setup-git-hooks.mjs
COPY packages/database/prisma.config.ts packages/database/prisma.config.ts
COPY packages/database/prisma/schema.prisma packages/database/prisma/schema.prisma

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .

RUN pnpm build

FROM build AS runtime

ENV NODE_ENV=development

RUN mkdir -p /workspace/apps/web/node_modules/.vite-temp && \
    chown -R node:node /workspace/apps/web/node_modules/.vite-temp

USER node

FROM runtime AS api

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]

FROM runtime AS worker

CMD ["node", "apps/worker/dist/main.js"]

FROM runtime AS web

EXPOSE 5173

CMD ["pnpm", "--filter", "@lex-os/web", "preview", "--host", "0.0.0.0", "--port", "5173"]
