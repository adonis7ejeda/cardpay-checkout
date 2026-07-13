# Cardpay Checkout

This repository contains a TypeScript checkout slice with a React Native-style mobile shell, a Nest.js checkout API, shared contracts, and deterministic payment rules. The implementation uses a generic card payment API boundary only; no provider credentials are stored in the repository.

## Quick path for reviewers

1. Install dependencies with pnpm.
2. Run the full test suite.
3. Run coverage and confirm mobile/API coverage stays above 80%.
4. Build the TypeScript packages used by the mobile shell and API.

```bash
pnpm install
pnpm test
pnpm coverage
pnpm --filter ./packages/contracts test
pnpm --filter ./apps/api build
pnpm --filter ./apps/mobile build
```

## Workspace commands

| Goal | Command | Notes |
|------|---------|-------|
| Install dependencies | `pnpm install` | Uses `pnpm@9.15.0` from `package.json`. |
| Run all tests | `pnpm test` | Runs contracts type-checking plus core, mobile, and API Jest suites. |
| Run all coverage | `pnpm coverage` | Runs workspace coverage scripts. |
| Run mobile coverage only | `pnpm --filter ./apps/mobile coverage` | Jest coverage for the mobile checkout shell. |
| Run API coverage only | `pnpm --filter ./apps/api coverage` | Jest coverage for the Nest.js checkout API. |
| Start mobile shell | `pnpm --filter ./apps/mobile start` | Prints readiness for the TypeScript mobile shell; native runtime packaging is deferred. |
| Start API locally | `pnpm --filter ./apps/api start:dev` | Starts the Nest.js API on `PORT` or `3000` by default. |
| Build API | `pnpm --filter ./apps/api build` | Compiles `apps/api` with TypeScript. |
| Build mobile shell | `pnpm --filter ./apps/mobile build` | Compiles `apps/mobile` with TypeScript. |

## Verification evidence

Last verified in PR 4 / Work Unit 4 on 2026-07-13.

| Check | Command | Result |
|-------|---------|--------|
| Full tests | `pnpm test` | Passed: contracts type-check, core 10 tests, mobile 15 tests, API 15 tests. |
| Full coverage | `pnpm coverage` | Passed. Mobile all files: 99.16% statements / 94.59% branches / 97.43% functions / 99% lines. API all files: 100% statements / 85.71% branches / 100% functions / 100% lines. |
| TypeScript builds | `pnpm --filter ./packages/contracts test && pnpm --filter ./apps/api build && pnpm --filter ./apps/mobile build` | Passed. |
| Mobile runtime note | `pnpm --filter ./apps/mobile start` | Passed: printed mobile TypeScript shell readiness. |
| Hygiene scan | `git grep -n -i -E "<provider-brand>|pub_[A-Za-z0-9]|prv_[A-Za-z0-9]|sk_[A-Za-z0-9]|pk_[A-Za-z0-9]" -- ':!*.pdf' ':!design-brief.md' ':!cardpay-checkout-ui-flow*'` | Passed: no tracked source or delivery documentation matches. Replace `<provider-brand>` with the forbidden sponsor/provider name before opening a public PR. |

Coverage must remain above 80% for both `apps/mobile` and `apps/api` before delivery.

## API notes

- `GET /catalog` returns backend-owned catalog items and purchasability data.
- `POST /transactions` validates cart totals, customer identity, fake card input, and payment-time stock before using the generic payment provider port.
- The current provider adapter is deterministic and fake. A real adapter is intentionally out of scope and must be added later behind environment-provided credentials.

Run the API locally:

```bash
pnpm --filter ./apps/api start:dev
```

Use `PORT=4000 pnpm --filter ./apps/api start:dev` when port `3000` is already in use.

## Mobile notes

- The mobile slice models the verified checkout flow: Splash, Products, Cart, Checkout, Card Info, Payment Summary, Success, and Failure.
- Redux owns cart and checkout state transitions.
- The persistence boundary stores a safe checkout snapshot and avoids raw full card data.
- Offline catalog reads can use a saved snapshot; payment submission requires network.

Run the mobile shell:

```bash
pnpm --filter ./apps/mobile start
```

## Android APK path

The native Android wrapper is deferred for this technical-test slice. When the Android project is added, the release APK should be generated from the mobile app and delivered from:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Until then, reviewers should use the TypeScript build and Jest coverage commands above as the delivery proof for the current mobile shell.

## Secret and branding hygiene

- Do not commit provider credentials, raw tokens, private keys, full card numbers, CVC values, or copied values from external PDFs.
- Keep provider-specific names out of package names, source paths, code, documentation, and UI copy.
- Use generic terms such as "payment provider" and "card payment API".
- Keep future real-provider configuration environment-based and document only variable names, never values.
- Before opening a public PR, run a hygiene scan for the forbidden sponsor/provider name and credential-like token prefixes across tracked files.

## Chained review context

This repository is delivered as a feature-branch chain. PR 4 / Work Unit 4 is the delivery-verification slice and depends on the foundation, mobile, and API slices.

| PR | Scope | Status |
|----|-------|--------|
| PR 1 | Workspace foundation, contracts, core rules | Complete |
| PR 2 | Mobile checkout shell | Complete |
| PR 3 | Nest.js checkout API | Complete |
| PR 4 | Delivery documentation, coverage evidence, hygiene checks | Current slice |

Rollback boundary for this slice: revert `README.md` and the delivery apply-progress artifact without changing application behavior.
