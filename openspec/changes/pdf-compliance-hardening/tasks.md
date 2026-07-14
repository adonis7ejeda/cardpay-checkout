# Tasks: PDF Compliance Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,800-4,000 total; 700-1,000 target/PR, 1,200 max |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 API/core → PR 2 mobile → PR 3 deployment → PR 4 evidence |
| Delivery strategy | force-chained / interactive |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | API lifecycle; base = tracker branch | PR 1 | `pnpm --filter @cardpay/api test` | `pnpm --filter @cardpay/api start:dev` fake checkout | API/contracts/core lifecycle files |
| 2 | RN Android secure state; base = PR 1 | PR 2 | `pnpm --filter @cardpay/mobile test -- --coverage` | `cd apps/mobile/android && ./gradlew assembleRelease` | `apps/mobile/**` |
| 3 | DynamoDB/Docker/CDK/Lambda; base = PR 2 | PR 3 | `pnpm --filter @cardpay/api test -- dynamodb` | `docker compose up --build`; `pnpm --filter infra cdk synth` | `infra/**`, Docker, Lambda/Dynamo adapters |
| 4 | Evidence/hygiene; base = PR 3 | PR 4 | `pnpm test` plus hygiene script | README local/APK/cloud commands | `README.md`, verification scripts |

## Dependency / Order Constraints

- [ ] 0.1 Create tracker branch first; PR 1 targets tracker, then each PR targets the immediate prior PR.
- [x] 0.2 Block any slice above 1,200 changed lines unless maintainer records `size:exception`. **PR 2 exception recorded**: ~1796 authored changed lines (1772 insertions + 24 deletions, excluding the 698-line generated Android native scaffold), ~596 over the 1200 ceiling. Maintainer decision: `size:exception` granted — PR2 is one coherent, atomic feature (full RN Android checkout flow conversion); splitting post-hoc would unpick already-integrated, fully green, tested code (screens depend on the extended store; `RootNavigator`/`App` depend on every screen) for no independent review benefit.

## PR 1: API Lifecycle / Contracts / Core

- [x] 1.1 Add RED Jest cases for signature order/swaps, status mapping, PAN/CVC no-leak, and safe errors in `packages/core/src/**` and `apps/api/src/**`.
- [x] 1.2 Update `packages/contracts/src/**` with `PaymentAttemptDto`, lifecycle, provider result, assignment, and installments contracts.
- [x] 1.3 Implement `apps/api/src/**` Nest flow: PENDING reference, tokenize, fetch acceptance token, sign, create, poll terminal status.
- [x] 1.4 Implement provider port/adapters: fake default, env-driven real adapter, no hardcoded credentials.
- [x] 1.5 Implement APPROVED/FAILED/RETRYABLE, approval-only stock decrement, and delivery assignment.
- [x] 1.6 Run PR 1 hygiene scan for provider credentials, copied tokens, PAN/CVC logs/responses, and disallowed branding.

## PR 2: Mobile RN Android / Secure State

- [x] 2.1 Replace `apps/mobile` shell with React Native Android project and documented APK output path.
- [x] 2.2 Build `apps/mobile/src/**` screens from OpenPencil 8-screen flow with responsive boundaries.
- [x] 2.3 Add Redux/Flux slices for catalog, cart, checkout, result, installments, and payment submission DTO mapping.
- [x] 2.4 Add `react-native-keychain` safe snapshot persistence excluding PAN, CVC, tokens, credentials, and branding.
- [x] 2.5 Add mobile tests for APK flow, responsive states, installments, PAN/CVC clearing, safe restore, and safe failures.
- [x] 2.6 Run PR 2 hygiene scan against mobile source, tests, snapshots, and Android artifacts.

## PR 3: Persistence / Deployment Adapters

- [ ] 3.1 Add RED tests for in-memory default, `DYNAMODB_ENDPOINT`, DynamoDB transaction/stock/delivery, and fake startup without secrets.
- [ ] 3.2 Implement DynamoDB repositories in `apps/api/src/**`; keep in-memory/fake default.
- [ ] 3.3 Add `Dockerfile` and `docker-compose.yml` for API plus optional DynamoDB Local parity.
- [ ] 3.4 Add `infra/**` CDK TypeScript stack in `us-east-1` for API Gateway, Lambda, DynamoDB, and env placeholders.
- [ ] 3.5 Add Lambda handler using `@codegenie/serverless-express` without changing local Nest bootstrap.
- [ ] 3.6 Run PR 3 hygiene scan and `cdk synth` to prove no hardcoded credentials.

## PR 4: Evidence / Hygiene / Readiness

- [ ] 4.1 Update `README.md` with local fake run, DynamoDB Local, AWS deployment, APK path, verification, and secret guidance.
- [ ] 4.2 Add verification scripts/tests for public hygiene: raw credentials/API keys, copied tokens, PAN/CVC persistence/logs/responses, and disallowed branding.
- [ ] 4.3 Record final evidence for tests, harnesses, coverage/tooling gaps, OpenPencil fidelity, and chained PR boundaries.
- [ ] 4.4 Verify each PR states scope, changed-line count, dependency, rollback boundary, and out-of-scope follow-up before review.
