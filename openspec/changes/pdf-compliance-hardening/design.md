# Design: PDF Compliance Hardening

## Technical Approach

Harden the existing pnpm monorepo without changing its public naming: convert `apps/mobile` from the current TypeScript shell into a real React Native Android app, extend the Nest API hexagonal boundary for provider lifecycle orchestration, and add local/AWS persistence/deployment adapters. The verified OpenPencil source (`cardpay-checkout-ui-flow.fig`) plus `design-brief.md` remain the UI source of truth; no sponsor-branded copy or raw credentials may enter artifacts.

## Architecture Decisions

| Area | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Mobile runtime | React Native app in `apps/mobile` with `android/` APK output | Keep TS shell | The spec requires a buildable Android artifact, not a simulated flow. |
| State boundary | Redux/Flux slices keep catalog/cart/checkout/result state; PAN/CVC stay transient UI input only | Persist entire checkout state | Reviewable transitions stay explicit while sensitive fields never enter persisted snapshots. |
| Persistence | `react-native-keychain` adapter persists only safe checkout and catalog snapshot | Plain JSON or full redux-persist | Device-backed encryption and allowlisted snapshots satisfy restart recovery without PAN/CVC leakage. |
| API architecture | Nest controllers → use cases → ports → adapters | Provider calls in controllers | Existing code already uses ports; use cases can enforce lifecycle, stock, delivery, and no-leak rules. |
| Provider integration | Env-driven real adapter plus default fake adapter | Real provider required locally | Local runs remain credential-free; integration is opt-in through env/secrets. |
| Cloud | CDK TypeScript stack in `us-east-1`, Lambda/API Gateway, DynamoDB, `@codegenie/serverless-express` | Always-on container service | Serverless minimizes free-tier risk while Docker still covers local/container parity. |
| Delivery | Forced feature-branch-chain slices, 700-1000 lines target, 1200 max | Single PR | Android, infra, and provider hardening exceed safe review size. |

## Data Flow

```text
RN UI/OpenPencil screens -> Redux checkout slice -> HTTP API
  | safe snapshot only                 |
  v                                    v
Keychain                       Nest controller
                               -> CheckoutUseCase
                               -> TransactionRepo(PENDING)
                               -> ProviderPort(tokenize, acceptance, sign, create, poll)
                               -> APPROVED: stock decrement + delivery assignment
                               -> FAILED/RETRYABLE: no stock decrement
```

PAN/CVC are submitted once to the backend for immediate tokenization, then cleared. Logs, records, responses, errors, delivery metadata, README, fixtures, and tests must only contain safe placeholders.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/mobile/android/**`, `apps/mobile/src/**` | Modify/Create | RN Android project, screens/backdrops, Redux slices, Keychain persistence, installments submission, tests. |
| `apps/api/src/**` | Modify/Create | Config, controllers/DTOs, use cases, provider port/adapters, DynamoDB repos, delivery assignment, Lambda handler. |
| `packages/contracts/src/**` | Modify | Replace fake-card/result DTOs with safe payment attempt, transaction lifecycle, delivery assignment contracts. |
| `packages/core/src/**` | Modify | Signature, status mapping, stock/delivery, sanitization, persistence allowlist helpers. |
| `infra/**`, `Dockerfile`, `docker-compose.yml` | Create | CDK stack, Lambda/API Gateway/DynamoDB, local Docker and DynamoDB Local. |
| `README.md`, verification scripts/tests | Modify/Create | Generic run/deploy/APK evidence and hygiene scans. |

## Interfaces / Contracts

Local statuses: `PENDING | APPROVED | FAILED | RETRYABLE`. Provider mapping: `APPROVED -> APPROVED`; `DECLINED | VOIDED -> FAILED`; `ERROR | timeout -> RETRYABLE`. Signature input is exactly `reference + amount_in_cents + currency + PAYMENT_PROVIDER_INTEGRITY_SECRET`. `PaymentAttemptDto` must include identity, cart, totals, transient card fields, customer email, and `installments`; persisted transaction/delivery records must store only token/reference/status/safe reasons.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | signature order, status mapping, sanitizer, stock/delivery helpers | Jest with swapped-order RED case and no-secret assertions. |
| API integration | tokenization flow, acceptance fetch, create/poll, fake mode, DynamoDB repos | Nest testing module with fake HTTP/provider clients and DynamoDB Local adapter tests. |
| Mobile | RN screens, Redux flow, Keychain allowlist, PAN/CVC clearing, installments | React Native tests targeting >80% mobile coverage. |
| Delivery | APK path, Docker/local start, CDK synth, hygiene scans | Commands documented in README; scan sponsor names, credential-like values, PAN/CVC persistence/logging/responses. |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no executable-file classification or doc execution. | Docs are inert evidence. | None. |
| Git repository selection | N/A: no VCS automation implemented. | Feature-branch-chain is process guidance only. | None. |
| Commit state | N/A: no commit automation. | Manual work-unit commits. | None. |
| Push state | N/A: no push automation. | Manual PR publication. | None. |
| PR commands | N/A: no PR command composition. | PR boundaries documented only. | None. |

## Migration / Rollout

No data migration required. Local default remains in-memory repos plus fake provider. `DYNAMODB_ENDPOINT` enables DynamoDB Local; AWS uses real DynamoDB and environment/secret placeholders.

## Chained PR Slices

1. API lifecycle/contracts/core hardening.
2. Mobile RN Android app and secure state boundary.
3. Persistence/deployment adapters: DynamoDB, Docker, CDK, Lambda wrapper.
4. Evidence/hygiene/readiness pass.

## Open Questions

- None blocking. AWS credentials and provider sandbox values must be supplied outside the repo for live validation.
