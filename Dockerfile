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

# ---- deps: install only what @cardpay/api needs (itself + contracts + core) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --filter "@cardpay/api..." --frozen-lockfile

# ---- build: compile contracts -> core -> api (in dependency order) ----
FROM deps AS build
COPY packages/contracts packages/contracts
COPY packages/core packages/core
COPY apps/api apps/api
RUN pnpm --filter @cardpay/contracts build \
  && pnpm --filter @cardpay/core build \
  && pnpm --filter @cardpay/api build

# ---- prod-deps: lean, production-only node_modules for the runtime image ----
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --filter "@cardpay/api..." --frozen-lockfile --prod

# ---- runtime: minimal image, no build tools, no dev dependencies ----
FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY --from=prod-deps /workspace/package.json ./package.json
COPY --from=prod-deps /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /workspace/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /workspace/packages/core/package.json ./packages/core/package.json
COPY --from=build /workspace/packages/core/dist ./packages/core/dist
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist

EXPOSE 3000
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
