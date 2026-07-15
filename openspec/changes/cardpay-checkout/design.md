# Design: Cardpay Checkout

## Technical Approach

Build a TypeScript monorepo from the current design-only repository. The implementation will create `apps/mobile`, `apps/api`, `packages/contracts`, and `packages/core`, keeping the verified 8-screen OpenPencil flow as the mobile source of truth and the backend as the catalog/stock/transaction authority. Shared contracts prevent mobile/API drift; pure checkout rules live in `packages/core` for deterministic Jest coverage.

## Architecture Decisions

| Area | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Repo layout | pnpm workspace with `apps/mobile`, `apps/api`, `packages/contracts`, `packages/core` | Separate repos, npm/yarn workspaces, or duplicated types | pnpm workspaces keep shared DTOs, core rules, tests, and chained PR slices coherent with fast installs. |
| Mobile stack | React Native with mandatory Redux, persisted encrypted checkout/cart state | Local component state or non-Redux stores | Redux gives explicit state transitions, restart recovery, and testable cart/outcome behavior. |
| Mobile UI | Components: `ProductCard`, `StockBadge`, `QuantityStepper`, `CartSummary`, `SummaryRow`, `PrimaryButton`, `BackdropShell`, `CardForm`, `PaymentSummary`, `TransactionStatus` | Screen-only implementation | Component mapping preserves the verified 8-screen flow while keeping review slices small. |
| Backend | TypeScript + Nest.js with Clean/Hexagonal modules | Thin CRUD controllers | Use cases depending on ports make stock validation, transaction persistence, and provider behavior testable. |
| Payment provider | Generic port, deterministic fake adapter first; real sandbox adapter deferred behind env vars | Direct provider SDK calls | Prevents secret leakage, enables deterministic tests, and isolates future provider changes. |
| Delivery | Forced chained PR work units under 800 changed lines | Single large PR | The empty repo plus mobile/API scope is high review-load risk. |

## Data Flow

```text
Mobile Redux ──GET /catalog──> API CatalogUseCase ──> CatalogPort
     │                                  │
     ├─ encrypted cart/checkout cache   └─ product/stock source
     │
     └─POST /transactions──> CheckoutUseCase ──> StockPort
                              │
                              ├─> PaymentProviderPort(fake first)
                              └─> TransactionRepositoryPort
```

Catalog may use a freshness-limited persisted snapshot for offline read/cart recovery. Payment submission always requires network. Success clears cart; failure preserves it.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, workspace config | Create | pnpm monorepo scripts for mobile, API, shared tests, and coverage. |
| `apps/mobile/` | Create | React Native screens, Redux slices, encrypted persistence, API client, UI components, Jest tests. |
| `apps/api/` | Create | Nest controllers, DTO validation, use cases, ports/adapters, fake payment adapter, transaction tests. |
| `packages/contracts/` | Create | Catalog/cart/checkout/payment/transaction DTOs and shared status types. |
| `packages/core/` | Create | Pricing totals, quantity rules, identity/card validation, masking, transaction outcome rules. |
| `README.md` | Create | Setup, run/test/build commands, coverage evidence, APK output path, secret hygiene. |

## Interfaces / Contracts

Contracts will define `CatalogItemDto`, `CartItemDto`, `CheckoutIdentityDto`, `PaymentAttemptDto`, and `TransactionResultDto`. `TransactionResultDto` is a safe union: `status: 'succeeded' | 'failed'`, `transactionId`, and customer-safe `message`; no raw secrets, private keys, full card data, or provider credentials are contract fields.

Backend ports: `CatalogPort`, `StockPort`, `PaymentProviderPort`, and `TransactionRepositoryPort`. Use cases own create/update transaction flow and validate stock before provider authorization.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | pricing, totals, card validation/masking, transaction state rules | Jest in `packages/core`, pure deterministic tests. |
| Mobile | Redux persistence, offline read/cart behavior, disabled offline payment, component states | Jest + React Native testing utilities, target >80% coverage. |
| API | catalog, stock rejection, provider success/failure, safe transaction persistence | Nest testing module with fake ports, target >80% coverage. |
| Delivery | README commands, APK path, secret/branding hygiene | Verification checklist and grep-style hygiene checks. |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no executable-file classification or doc execution is designed. | Treat docs as inert artifacts. | None. |
| Git repository selection | N/A: no VCS automation is implemented. | Chained PRs are process guidance only. | None. |
| Commit state | N/A: no commit automation is implemented. | Manual commits by work unit. | None. |
| Push state | N/A: no push automation is implemented. | Manual PR delivery. | None. |
| PR commands | N/A: no PR command composition is implemented. | PR template guidance only. | None. |

## Migration / Rollout

No data migration required. Roll out as chained slices: foundation/shared contracts, mobile flow, API/payment flow, verification/docs/APK evidence. The real sandbox adapter remains deferred and must be env-var gated.

## Open Questions

- None.
