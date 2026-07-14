# syntax=docker/dockerfile:1
#
# Multi-stage production Dockerfile for the CardPay checkout API (@cardpay/api).
#
# Scope: this image builds and runs ONLY the API workspace (@cardpay/api) plus
# its two workspace dependencies (@cardpay/contracts, @cardpay/core). It does
# NOT install or build apps/mobile (React Native), keeping the image small and
# avoiding an unrelated native toolchain in the container.
#
# Runtime behavior is unchanged from local dev: with no AWS/provider env vars
# set, the container starts credential-free using in-memory repositories and
# the deterministic fake payment provider. Setting DYNAMODB_ENDPOINT switches
# persistence to DynamoDB (Local or real AWS), and setting the three
# PAYMENT_PROVIDER_* env vars switches the payment adapter to the real
# env-driven provider. See docker-compose.yml for local wiring examples.

FROM node:22-alpine AS base
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- build: install the full workspace graph, then compile contracts -> core -> api ----
#
# Every workspace member's package.json must be present (even apps/mobile and infra,
# which this image never runs) for `pnpm install` to fully resolve the workspace
# graph. A partial checkout (only apps/api + its direct deps) silently breaks
# `workspace:*` symlinking: the build still succeeds because tsc resolves
# @cardpay/contracts/@cardpay/core via tsconfig path mapping, not node_modules, so
# the missing symlink only surfaces later as a runtime `Cannot find module
# '@cardpay/core'` crash -- caught by actually running `docker compose up`.
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY infra/package.json infra/package.json
RUN pnpm install --frozen-lockfile
COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY apps/api apps/api
RUN pnpm --filter @cardpay/contracts build \
  && pnpm --filter @cardpay/core build \
  && pnpm --filter @cardpay/api build

# `pnpm deploy` produces a self-contained package directory with a real
# (non-symlinked) node_modules -- the officially recommended way to get a
# pnpm workspace package out of a monorepo and into a Docker image without
# broken cross-stage symlinks. See https://pnpm.io/docker.
RUN pnpm --filter @cardpay/api deploy --prod /prod/api

# ---- runtime: minimal image, no build tools, no dev dependencies ----
FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /prod/api ./

EXPOSE 3000
CMD ["node", "dist/apps/api/src/main.js"]
