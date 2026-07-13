# Tasks: Cardpay Checkout

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,200-1,800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 foundation → PR 2 mobile → PR 3 API → PR 4 verification |
| Delivery strategy | auto-chain / forced chained delivery |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | pnpm workspace, contracts, core rules | PR 1 → tracker branch | `pnpm test --filter ./packages/core -- --coverage` | N/A: no runnable app yet | `package.json`, `pnpm-workspace.yaml`, `packages/*` |
| 2 | React Native checkout flow | PR 2 → PR 1 branch | `pnpm test --filter ./apps/mobile -- --coverage` | `pnpm --filter ./apps/mobile start` | `apps/mobile` |
| 3 | Nest.js checkout API + fake provider | PR 3 → PR 2 branch | `pnpm test --filter ./apps/api -- --coverage` | `pnpm --filter ./apps/api start:dev` | `apps/api` |
| 4 | Delivery docs, coverage, APK path, hygiene | PR 4 → PR 3 branch | `pnpm test -- --coverage` | README run/build walkthrough | `README.md`, delivery scripts/docs |

## Phase 1: Foundation / Contracts

- [x] 1.1 Create `package.json`, `pnpm-workspace.yaml`, and workspace scripts for install, test, coverage, mobile, and API commands.
- [x] 1.2 Create `packages/contracts/src` DTOs for catalog, cart, identity, payment attempt, and safe transaction results with no secret fields.
- [x] 1.3 Create `packages/core/src` pricing, quantity, identity, card/Luhn, masking, and outcome rules with Jest coverage.

## Phase 2: Mobile Checkout

- [ ] 2.1 Create `apps/mobile` React Native shell with Redux store, encrypted persistence boundary, API client, and 8-screen navigation.
- [ ] 2.2 Add `ProductCard`, `StockBadge`, `QuantityStepper`, `CartSummary`, `SummaryRow`, `PrimaryButton`, `BackdropShell`, `CardForm`, `PaymentSummary`, and `TransactionStatus`.
- [ ] 2.3 Test catalog load, offline snapshot, restart recovery, missing identity errors, invalid card blocking, backdrop cancel, success clear, and failure preserve scenarios.

## Phase 3: API Checkout

- [ ] 3.1 Create `apps/api` Nest modules with controllers and DTO validation for `GET /catalog` and `POST /transactions`.
- [ ] 3.2 Add Clean/Hexagonal use cases with `CatalogPort`, `StockPort`, `PaymentProviderPort`, and `TransactionRepositoryPort`.
- [ ] 3.3 Add deterministic fake payment adapter and tests for stock rejection before provider, success persistence, failed safe reason, and deterministic provider results.

## Phase 4: Delivery / Verification

- [ ] 4.1 Update `README.md` with setup, run, test, coverage, API, mobile, Android APK path, and secret hygiene guidance.
- [ ] 4.2 Add verification checks for >80% mobile/API coverage and absence of raw credentials or sponsor-branded repo/code/UI copy.
