# Proposal: Cardpay Checkout

## Intent

Build a React Native mobile checkout and TypeScript/Nest.js backend for a card payment technical test. The change turns the verified 8-screen OpenPencil flow into a testable product slice with backend-owned catalog, payment-time stock validation, persisted checkout resilience, and generic payment-provider boundaries.

## Scope

### In Scope
- Monorepo foundation with mobile, API, shared contracts, README, and test/coverage tooling.
- React Native checkout flow matching the verified screens: Splash, Products, Cart, Checkout, Card Info, Payment Summary, Success, Failure.
- Redux state persistence for checkout/cart with partial offline read/cart resilience; payment requires network.
- Nest.js API for catalog, transaction orchestration, payment-time stock validation, and transaction result persistence.
- Payment provider port with deterministic mock/fake adapter for this slice.
- Jest coverage target above 80% for mobile and backend; APK deliverable path documented.

### Out of Scope
- Real sandbox payment adapter; deferred to a later environment-variable-backed slice.
- iOS build delivery, cloud deployment, and sponsor-branded copy or identifiers.

## Capabilities

### New Capabilities
- `mobile-checkout-flow`: React Native UI, Redux state, validation, persistence, offline read/cart behavior, and APK delivery.
- `checkout-api`: Nest.js catalog, stock validation, transaction lifecycle, and payment-provider port behavior.
- `shared-payment-contracts`: DTOs and shared validation contracts across mobile and API.
- `delivery-verification`: README, Jest coverage evidence, build/test commands, and chained review delivery expectations.

### Modified Capabilities
- None; `openspec/specs/` has no existing capability specs.

## Approach

Use a monorepo with `apps/mobile`, `apps/api`, and shared packages. Keep backend modules hexagonal: use cases depend on catalog/stock/payment ports, with the first payment adapter mocked for deterministic tests. Implement as forced chained PR slices within the 800-line review budget: foundation, mobile flow, API flow, verification/build docs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/mobile/` | New | React Native checkout app and tests |
| `apps/api/` | New | Nest.js API, ports, adapters, tests |
| `packages/contracts/` | New | Shared DTOs/types |
| `packages/core/` | New | Pure pricing, validation, masking/state rules |
| `README.md` | Modified | Run/test/build and coverage evidence |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Empty source tree increases setup scope | Med | Start with foundation slice |
| Payment data leakage | Med | No raw secrets; env vars and masked/log-safe data only |
| Coverage target missed | Med | Move rules into pure tested modules |
| Oversized review | High | Forced chained PR work units |

## Rollback Plan

Revert chained slices in reverse order. Foundation rollback removes new workspace/config/packages; feature rollback removes `apps/mobile`, `apps/api`, contracts, docs, and build artifacts without touching design assets.

## Dependencies

- Verified OpenPencil flow and design brief.
- Backend-provided catalog and payment-time stock validation.
- Environment variables for future real payment adapter only.

## Success Criteria

- [ ] Mobile flow matches the verified 8-screen flow and handles success/failure.
- [ ] Backend validates stock at payment time and records transaction outcomes.
- [ ] Customer name/email are mandatory before payment.
- [ ] Mobile and backend Jest coverage exceed 80%.
- [ ] README documents run/test/build, coverage evidence, and APK generation.
