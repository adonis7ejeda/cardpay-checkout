# Apply Progress: Cardpay Checkout

## Mode

Standard apply mode. Strict TDD is disabled in `openspec/config.yaml`.

## Chained PR Boundary

| Field | Value |
|-------|-------|
| Strategy | Feature branch chain |
| Current work unit | PR 4 / Work Unit 4: Delivery verification |
| Starts after | PR 3 API checkout slice |
| Ends with | Reviewer-facing README, verification evidence, hygiene guidance, and completed delivery-verification tasks |
| Rollback boundary | `README.md`, `openspec/changes/cardpay-checkout/apply-progress.md`, and PR 4 task checkbox updates |

## Completed Tasks

- [x] 1.1 Create `package.json`, `pnpm-workspace.yaml`, and workspace scripts for install, test, coverage, mobile, and API commands.
- [x] 1.2 Create `packages/contracts/src` DTOs for catalog, cart, identity, payment attempt, and safe transaction results with no secret fields.
- [x] 1.3 Create `packages/core/src` pricing, quantity, identity, card/Luhn, masking, and outcome rules with Jest coverage.
- [x] 2.1 Create `apps/mobile` React Native shell with Redux store, encrypted persistence boundary, API client, and 8-screen navigation.
- [x] 2.2 Add `ProductCard`, `StockBadge`, `QuantityStepper`, `CartSummary`, `SummaryRow`, `PrimaryButton`, `BackdropShell`, `CardForm`, `PaymentSummary`, and `TransactionStatus`.
- [x] 2.3 Test catalog load, offline snapshot, restart recovery, missing identity errors, invalid card blocking, backdrop cancel, success clear, and failure preserve scenarios.
- [x] 3.1 Create `apps/api` Nest modules with controllers and DTO validation for `GET /catalog` and `POST /transactions`.
- [x] 3.2 Add Clean/Hexagonal use cases with `CatalogPort`, `StockPort`, `PaymentProviderPort`, and `TransactionRepositoryPort`.
- [x] 3.3 Add deterministic fake payment adapter and tests for stock rejection before provider, success persistence, failed safe reason, and deterministic provider results.
- [x] 4.1 Update `README.md` with setup, run, test, coverage, API, mobile, Android APK path, and secret hygiene guidance.
- [x] 4.2 Add verification checks for >80% mobile/API coverage and absence of raw credentials or sponsor-branded repo/code/UI copy.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm test` passed: contracts type-check, core 10 tests, mobile 15 tests, API 15 tests. `pnpm coverage` passed: mobile 99.16% statements / 94.59% branches / 97.43% functions / 99% lines; API 100% statements / 85.71% branches / 100% functions / 100% lines. |
| Runtime harness command/scenario and exact result | `pnpm --filter ./apps/mobile start` passed and printed mobile shell readiness. API runtime is documented with `pnpm --filter ./apps/api start:dev`; API behavior is covered through Nest/Supertest integration tests in `pnpm test`. |
| Rollback boundary | Revert `README.md`, `openspec/changes/cardpay-checkout/apply-progress.md`, and the Phase 4 checkbox updates in `openspec/changes/cardpay-checkout/tasks.md`. |

## Additional Verification

| Check | Command | Result |
|-------|---------|--------|
| TypeScript builds | `pnpm --filter ./packages/contracts test; pnpm --filter ./apps/api build; pnpm --filter ./apps/mobile build` | Passed. |
| Attempted focused coverage command from task forecast | `pnpm test -- --coverage` | Failed because pnpm treats `--coverage` as an unknown root `pnpm test` option in this workspace. README documents the verified command: `pnpm coverage`. |
| Hygiene scan | `git grep -n -i -E "<provider-brand>|pub_[A-Za-z0-9]|prv_[A-Za-z0-9]|sk_[A-Za-z0-9]|pk_[A-Za-z0-9]" -- ':!*.pdf' ':!design-brief.md' ':!cardpay-checkout-ui-flow*'` | Passed with no tracked source or delivery documentation matches. |

## Deviations

None. Delivery documentation follows the design requirement for README setup, run/test/build commands, coverage evidence, APK path, and secret/branding hygiene.
