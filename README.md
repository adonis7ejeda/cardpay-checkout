# CardPay Checkout

A real, working card-checkout system built as a technical test:

- **`apps/api`** — a NestJS API (`GET /catalog`, `POST /transactions`, `GET /transactions/:transactionId`) with pluggable persistence (in-memory by default, DynamoDB when configured) and a pluggable payment provider (a deterministic fake by default, a real env-driven adapter when fully configured).
- **`apps/mobile`** — a real React Native 0.76.5 Android app (8 screens, Redux, `react-native-keychain` secure persistence) that talks to the API.
- **`infra`** — an AWS CDK v2 stack deploying API Gateway → Lambda → DynamoDB.
- **`packages/contracts`** / **`packages/core`** — shared DTOs and framework-free payment/catalog/identity rules used by both the API and the mobile app.

This repository never names the payment provider it integrates with. Everywhere in code, docs, comments, and UI copy it is referred to generically as "the payment provider" or "the card payment API." Real provider credentials are never hardcoded or committed — see [Secret and credential hygiene](#secret-and-credential-hygiene).

## Workspace layout

| Path | What it is |
|------|------------|
| `apps/api` | NestJS checkout API. |
| `apps/mobile` | React Native Android checkout app. |
| `infra` | AWS CDK v2 deployment stack. |
| `packages/contracts` | Shared request/response DTOs. |
| `packages/core` | Shared, framework-free domain rules (pricing, card validation, provider-status mapping, signing). |
| `scripts/hygiene-scan.js` | Public-delivery hygiene gate (see [Hygiene scan](#hygiene-scan)). |

## Local run (credential-free default)

With no environment variables set, the API boots with an in-memory catalog/transaction store and a deterministic fake payment provider — no AWS account, Docker, or real provider credentials needed.

```bash
pnpm install
pnpm --filter ./apps/api start:dev
```

The API listens on `PORT` (defaults to `3000`). Use `PORT=4000 pnpm --filter ./apps/api start:dev` if `3000` is already taken.

Hit it with curl:

```bash
curl http://localhost:3000/catalog
```

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "identity": { "fullName": "Ada Lovelace", "email": "ada@example.com" },
    "cartItems": [
      { "productId": "basic-tee", "quantity": 1, "unitPrice": { "amount": 45000, "currency": "COP" } }
    ],
    "totals": {
      "subtotal": { "amount": 45000, "currency": "COP" },
      "total": { "amount": 45000, "currency": "COP" },
      "itemCount": 1
    },
    "card": {
      "cardholderName": "Ada Lovelace",
      "number": "4111111111111111",
      "expirationMonth": "12",
      "expirationYear": "2030",
      "cvc": "123"
    },
    "installments": 1
  }'
```

The fake provider approves any card except one ending in `0000` (use a number like `4111111111111111` to approve, or `4111111111110000` to force a decline). The response includes a `transactionId`; if a transaction is ever returned as `PENDING`, poll its final status with:

```bash
curl http://localhost:3000/transactions/<transactionId>
```

## DynamoDB Local (optional, via Docker Compose)

The API's persistence is env-driven: set `DYNAMODB_ENDPOINT` and it switches from in-memory storage to DynamoDB (Local or real AWS) automatically, with no code changes.

Default (credential-free, in-memory, matches the local run above, containerized):

```bash
docker compose up --build
```

Full persistence parity with DynamoDB Local (opt-in `dynamodb` Compose profile). `DYNAMODB_ENDPOINT` must be set explicitly in the shell that runs the command — the compose file only passes it through, it does not default it to the DynamoDB Local container on its own:

```bash
DYNAMODB_ENDPOINT=http://dynamodb-local:8000 docker compose --profile dynamodb up --build
```

This starts `amazon/dynamodb-local` alongside the API and points the API at it. Verify it picked up DynamoDB by hitting the same endpoints as above — `GET /catalog` and `POST /transactions` behave identically, but state now lives in the local DynamoDB tables (`cardpay-transactions`, `cardpay-catalog-stock`) instead of memory, and survives an API container restart as long as `dynamodb-local` keeps running.

## AWS deployment

The `infra` package is a standalone AWS CDK v2 TypeScript app provisioning API Gateway → Lambda → 3 DynamoDB tables (`cardpay-transactions`, `cardpay-catalog-stock`, `cardpay-delivery-assignments`) in `us-east-1` by default.

```bash
cd infra
npx cdk bootstrap   # first deployment to an account/region only
npx cdk deploy
```

(Equivalently, from the repo root: `pnpm --filter infra cdk bootstrap` / `pnpm --filter infra cdk deploy`.)

After deploying, the payment provider stays on the deterministic fake until an operator manually adds these three environment variables to the deployed Lambda function (AWS Console → Lambda → Configuration → Environment variables — this repository intentionally never wires real payment credentials in code or CDK):

- `PAYMENT_PROVIDER_PUBLIC_KEY`
- `PAYMENT_PROVIDER_INTEGRITY_SECRET`
- `PAYMENT_PROVIDER_BASE_URL`

Never commit real values for these, and never commit AWS credentials. Rotate any credential that was ever pasted into a terminal, log, or chat transcript, even if it was never committed.

## Mobile (Android)

Requirements: `ANDROID_HOME` set to the Android SDK (e.g. on Windows, `%LOCALAPPDATA%\Android\Sdk`) and `adb` on `PATH`.

### Run against a local backend

Without a `.env` file, **both debug and release builds** default to the deployed AWS Lambda URL baked into `apps/mobile/src/App.tsx` (`resolveApiBaseUrl()`) — this is the out-of-the-box default so the app works with zero setup. To point it at a local backend instead:

1. Start the API locally (see [Local run](#local-run-credential-free-default) above).
2. Point the emulator/device at it: `adb reverse tcp:3000 tcp:3000`.
3. Copy `apps/mobile/.env.example` to `apps/mobile/.env` (git-ignored) and set `API_BASE_URL=http://localhost:3000`. `react-native-config` reads this file at native build time, so it's baked into the app on the next build.
4. Build and run:

```bash
cd apps/mobile/android
./gradlew assembleDebug
```

### Run against a different deployed backend

Same `.env` mechanism — set `API_BASE_URL` in `apps/mobile/.env` to any backend URL (e.g. a different deployed stack) instead of `http://localhost:3000`.

### Release APK

```bash
cd apps/mobile/android
./gradlew assembleRelease
```

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. A prebuilt release APK, ready to install, is also committed directly in this repository at:

```text
apps/mobile/release/app-release.apk
```

## Verification / evidence

Run everything:

```bash
pnpm test
```

Per-package:

```bash
pnpm --filter ./packages/contracts test   # tsc --noEmit type-check
pnpm --filter ./packages/core test        # 19 tests
pnpm --filter ./apps/api test             # 80 tests, 8 suites
pnpm --filter ./apps/mobile test          # 100 tests, 20 suites
pnpm --filter ./apps/mobile test -- --coverage
```

Other useful checks:

```bash
pnpm --filter @cardpay/api build          # compiles the API
npx tsc -p apps/mobile/tsconfig.json --noEmit
cd infra && npx cdk synth                 # validates the CDK stack with no AWS credentials needed
```

### Hygiene scan

```bash
pnpm hygiene
```

Runs `scripts/hygiene-scan.js` against every git-tracked file (via `git ls-files`, so `node_modules`, build output, and `.env` files are naturally excluded) and fails (non-zero exit) if it finds:

1. The disallowed sponsor/payment-provider brand name, case-insensitive.
2. Credential/API-key-shaped strings (`pub_...`, `prv_...`, `sk_...`, `pk_...`, AWS access keys `AKIA...`, or generic 32+ character secret-looking assignments).
3. `console.log`/`console.warn`/`console.error` calls referencing card/CVC/PAN-like identifiers.

As of this writing, `pnpm hygiene` reports a clean PASS with zero findings across every tracked file in this repository.

## Secret and credential hygiene

- Never commit `.env`, real `PAYMENT_PROVIDER_*` values, or AWS credentials. `.env` and `.env.*` (except `.env.example`) are already git-ignored.
- If a real credential is ever exposed (typed into a terminal, pasted into a chat, or briefly printed by a diagnostic command), rotate it — being git-ignored does not undo exposure that already happened outside git.
- The sponsor/payment-provider brand name must never appear anywhere in this repository — source, docs, comments, or future commit messages. Run `pnpm hygiene` before opening a PR to confirm.
- Card data (PAN, CVC) is only ever used transiently to build a tokenization request; it is never logged, never persisted, and never included in a keychain/persistence snapshot on the mobile side.

## Chained delivery context

This project was delivered as a chain of feature branches, each based on the previous one:

| Branch | Scope |
|--------|-------|
| `feat/foundation` → `feat/api-checkout` → `feat/mobile-checkout-flow` → `feat/root-jest-config` → `feat/delivery-verification` | Original TypeScript-only slice: shared contracts/core rules, a Nest.js checkout API, a mobile TypeScript shell, workspace Jest config, and initial delivery docs. |
| `feat/pdf-hardening-api-lifecycle` | Hardened the API's payment-provider lifecycle: real signature order, tokenize → acceptance token → create → poll flow, fake and env-driven provider adapters, stock/delivery rules. |
| `feat/pdf-hardening-mobile-rn` | Converted the mobile shell into a real React Native 0.76.5 Android app: 8 OpenPencil screens, Redux, secure keychain persistence. |
| `feat/pdf-hardening-persistence-deployment` | Added DynamoDB persistence adapters, Docker/Docker Compose, and the AWS CDK deployment stack (API Gateway → Lambda → DynamoDB). |
| `feat/pdf-hardening-transaction-reconciliation` | Added the `GET /transactions/:transactionId` reconciliation endpoint for transactions that came back `PENDING`, plus mobile-side bounded polling and a deployed-backend URL fix. |
| `feat/pdf-hardening-evidence-hygiene` (this branch) | Rewrote this README to match the real system and added the `pnpm hygiene` verification gate. |

Each branch is based on the previous one and went through the same bounded-review process before the next began. Consult `git log --oneline --graph` for the exact commit history and the repository's pull requests for per-slice review discussion.
