# Apply Progress: PDF Compliance Hardening

## Mode

Hybrid OpenSpec + Engram, forced feature-branch-chain, PR 1 / Work Unit 1: API Lifecycle / Contracts / Core. Standard TDD mode.

## Completed Tasks

- [x] 1.1–1.6 API lifecycle/contracts/core hardening: tests, contracts, provider orchestration, fake/env provider adapters, local statuses, stock/delivery rules, and hygiene scan.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm --filter ./packages/core test` → PASS, 1 suite / 14 tests. `pnpm --filter ./packages/contracts test` → PASS, TypeScript no emit. `pnpm --filter ./apps/api test` → PASS, 1 suite / 26 tests. |
| Runtime harness command/scenario and exact result | `pnpm test` → PASS across workspace packages, including API, core, contracts, and existing mobile tests. API fake checkout path is covered by Nest/supertest and use-case tests; no long-running server was left active. |
| Rollback boundary | Revert PR1 edits under `apps/api/**`, `packages/contracts/src/payment.ts`, `packages/contracts/src/transaction.ts`, `packages/core/src/provider-lifecycle.ts`, `packages/core/src/index.ts`, `packages/core/src/core.test.ts`, plus this OpenSpec progress/tasks update. |

## Verification Results

- PASS: `pnpm --filter ./packages/core test` (14), `pnpm --filter ./packages/contracts test`, `pnpm --filter ./apps/api test` (25), `pnpm test`, hygiene grep checks.

## Bounded Correction Evidence

- Review lineage: `review-0cc242c68606b533`.
- Scope: PR 1 API lifecycle/contracts/core correction only; mobile, AWS/CDK, Docker, DynamoDB, Lambda, APK, and final README remain out of scope.
- Corrected provider wiring, runtime validation, pending semantics, PAN sanitization, stock reservation/release, package entrypoints, and nested DTO validation.
- Correction verification: core/contracts/API/workspace tests passed; API suite has 25 tests.
- Correction line estimate: approximately 105 authored changed lines, within the 180-line forecast.

## Terminal Review Round (lineage `review-3ad27841c4de8c27`)

- Risk CRITICAL: `createDefaultPaymentProvider` silently fell back to the deterministic fake provider with zero provider env vars configured, with no guard against this happening in a real deployment. Fixed: fallback now throws when `NODE_ENV === "production"` and no provider env is configured; regression test added.
- Reliability CRITICAL / Resilience WARNING: flagged a mismatch between the implementation (PENDING stays PENDING with stock held after bounded polling) and the spec text (said timeout exhaustion becomes RETRYABLE and releases stock). Resolved by product decision: keep the implementation, clarify the spec with an explicit "Bounded polling exhausted while still PENDING" scenario distinct from the technical-error/RETRYABLE case.

## Notes

Local API remains credential-free by default. Provider credentials stay env-only, and PAN/CVC are transient tokenization inputs only. Deferred scope remains mobile RN, AWS/Docker/DynamoDB/Lambda, APK, and final delivery evidence.

## PR 2: Mobile RN Android / Secure State

Branch `feat/pdf-hardening-mobile-rn`, based on PR1's `feat/pdf-hardening-api-lifecycle` (feature-branch-chain). Strict TDD mode active throughout.

### Completed Tasks

- [x] 2.1 Replaced the `apps/mobile` TypeScript shell's absence of a native host with a real React Native 0.76.5 Android project. Scaffolded via `npx @react-native-community/cli@15.0.1 init` into a scratch directory (not hand-typed), then copied `android/**` (real `gradlew`/`gradlew.bat`, `gradle-wrapper.jar` binary, `build.gradle` x2, `settings.gradle`, `AndroidManifest.xml` x2, `MainActivity.kt`/`MainApplication.kt` under `com.cardpaycheckout.mobile`, launcher icons, `strings.xml` branded to "CardPay") into `apps/mobile/android/`, fixing a CLI package-path nesting quirk (`java/com/com.cardpaycheckout.mobile` → `java/com/cardpaycheckout/mobile`). Root RN config (`babel.config.js`, `metro.config.js`, `.watchmanconfig`, `app.json`, `index.js`) copied from the same scaffold. `index.js` points at `./src/App`.
  - **Documented APK build commands** (verified `./gradlew` wrapper + `gradle-wrapper.properties` present and correctly wired to `../node_modules/@react-native/gradle-plugin`; NOT executed end-to-end because this sandbox has no Android SDK/`ANDROID_HOME`, only Node/pnpm):
    - Debug APK: `cd apps/mobile/android && ./gradlew assembleDebug` → output at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
    - Release APK: `cd apps/mobile/android && ./gradlew assembleRelease` → output at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (uses the bundled `debug.keystore` from the template as a placeholder signing config — real release signing must replace this before store distribution).
  - iOS project files were intentionally NOT copied (out of scope: spec only requires an Android-capable RN app + APK path).
- [x] 2.2 Built all 8 OpenPencil screens as real RN presentational components under `apps/mobile/src/screens/**`: `SplashScreen`, `HomeProductsScreen`, `SelectProductScreen`, `CheckoutScreen` (now also collects customer name/email, gating "Pay with credit card"), `CardInfoBackdrop`, `PaymentSummaryBackdrop`, `TransactionStatusScreen` (one component renders both the success and the fully-mocked failure frame via a `result` discriminated union). Shared atoms in `apps/mobile/src/ui/**` (`PrimaryButton`, `ProductCard`, `BackdropShell`). Responsive layout is driven by a pure, unit-tested `getResponsiveLayout(width, height)` helper (`src/layout/responsive.ts`) proven not to clip from the documented 750x1334 floor up through tablet widths. `RootNavigator.tsx` wires redux state to these screens and drives the Splash → Home → Select Product → Checkout → Card Info → Payment Summary → Final Status → Home flow, treating on-screen position as ephemeral UI state (not persisted) while catalog/cart/identity remain the Redux/keychain source of truth.
- [x] 2.3 Extended (not duplicated) the existing `src/store.ts` checkout slice: added `installments` (default 1, `INSTALLMENT_OPTIONS = [1,3,6,12,18,24]`), `setInstallments` reducer, and an extracted `buildPaymentAttempt(state)` selector performing the exact DTO mapping (`identity`, `cartItems`, `totals`, `card`, `installments`) reused by both `submitPayment` and its unit tests. `paymentFinished` now clears the transient fake-card fields (PAN/CVC/expiry/holder) after every backend response, success or failure — this was a real, previously-unmet spec requirement in the inherited PR1 shell. Catalog/cart/checkout/result concerns already coexisted in one well-tested reducer (`checkoutSlice`) from the prior shell; given the safety-net regression suite (`mobile.test.ts`) asserts on that single-slice shape, this PR organizes by responsibility inside that slice plus new dedicated modules (`format.ts`, `layout/responsive.ts`, `keychainStorage.ts`, `persistence.ts#toSafeSnapshot`) rather than physically fragmenting into 5 separate top-level Redux slices, to avoid an unreviewable rewrite risk. Documented as a deliberate interpretation below.
- [x] 2.4 Added `src/keychainStorage.ts` (`KeychainSecureStorage`), a `SecureStorageBoundary` implementation backed by `react-native-keychain`'s generic-password API (`setGenericPassword`/`getGenericPassword`/`resetGenericPassword`), namespaced per logical key via the `service` option. Added `persistence.ts#toSafeSnapshot(state)`, an explicit allowlist mapper (catalog/cart/identity/timestamp only) used by `persistCheckout`, so PAN/CVC/installments/transaction results can never leak into a persisted snapshot even if `CheckoutState` grows new fields later. A Jest manual mock (`__mocks__/react-native-keychain.ts`) backs an in-memory map for tests (no real device keystore in CI/sandbox).
- [x] 2.5 Added focused tests for every required behavior: `keychainStorage.test.ts` (round-trip/remove/namespacing), `persistence.test.ts` (`toSafeSnapshot` allowlist + regression guard that raw PAN/CVC/installments never serialize), `paymentSubmission.test.ts` (installments included in the submitted DTO; PAN/CVC cleared after success AND failure), `appRestart.test.ts` (safe restore of cart/identity from the real keychain adapter after a simulated restart, with fake-card never restored; safe explicit-error failure when offline with no snapshot), plus one RNTL test file per screen/UI atom and a full `RootNavigator.test.tsx` + `App.test.tsx` end-to-end flow (Splash → add to cart → select product → checkout with identity → card entry with a chosen installment count → payment summary → success, and a second full run ending in a preserved-cart failure + "Try again"). Coverage: 95.86% statements / 90.54% branches / 92.72% functions / 95.83% lines (`coverageThreshold` in `jest.config.cjs` requires 80% on all four; enforced by `pnpm --filter ./apps/mobile test -- --coverage`).
- [x] 2.6 Hygiene scan: `rg -i PROVIDER apps/mobile` → zero matches (source, tests, android artifacts, config). Scanned for hardcoded API keys/secrets/tokens and for `console.log`/`console.warn`/`console.error` referencing card/CVC/PAN/number → zero matches. Test fixtures intentionally use well-known public Luhn-valid test PANs (`4111111111111111`, per design-brief.md's own guidance to never use a real PAN) — these are fake test data, not the "raw/real credential" hygiene scan does not flag test fixtures explicitly called for by the brief.

### TDD Cycle Evidence

| Task | Test File(s) | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-------------|-------|------------|-----|-------|-------------|----------|
| 2.4 | `keychainStorage.test.ts` | Unit | N/A (new) | Written | Passed | 4 cases | Clean |
| 2.3 | `paymentSubmission.test.ts` | Unit | `mobile.test.ts` 12/12 pass before + after | Written | Passed | 5 cases | Clean |
| 2.4 | `persistence.test.ts` | Unit | N/A (new fn) | Written | Passed | 3 cases | Clean |
| 2.5 | `appRestart.test.ts` | Integration (store+keychain) | N/A (new) | N/A — composition of already-tested units, passed immediately | Passed | 3 cases | Clean |
| 2.2 | `ui/PrimaryButton.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed | 2 cases | Clean |
| 2.2 | `layout/responsive.test.ts` | Unit | N/A (new) | Written | Passed | 4 cases | Clean |
| 2.2 | `ui/ProductCard.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed | 5 cases | Clean |
| 2.2 | `screens/HomeProductsScreen.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed | 4 cases | Clean |
| 2.2 | `screens/SelectProductScreen.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed | 4 cases | Clean |
| 2.2 | `screens/CheckoutScreen.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed (2nd RED cycle added identity gating) | 5 cases | Clean |
| 2.2 | `ui/BackdropShell.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed | 2 cases | Clean |
| 2.2/2.3 | `screens/CardInfoBackdrop.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed | 5 cases | Clean |
| 2.2 | `screens/PaymentSummaryBackdrop.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed (role/accessible fix) | 4 cases | Clean |
| 2.2 | `screens/TransactionStatusScreen.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed (text-match fix) | 2 cases | Clean |
| 2.2 | `screens/SplashScreen.test.tsx` | Component (RNTL) | N/A (new) | Written | Passed | 3 cases | Clean |
| 2.1/2.2/2.3 | `RootNavigator.test.tsx` | Integration (Redux+RNTL) | N/A (new) | Written | Passed (identity-gating fix) | 2 full-flow cases | Clean |
| 2.1 | `App.test.tsx` | Integration (RNTL) | N/A (new) | Written | Passed | 1 case (smoke + behavioral hydration assertion) | Clean |

### Test Summary

- Total tests written this PR: 51 (75 total in `apps/mobile` after merging with the pre-existing 24 from PR1's shell).
- Total tests passing: 75/75.
- Layers used: Unit (23), Component/RNTL (37), Integration (15).
- Pure functions created: `getResponsiveLayout`, `formatMoney`, `toSafeSnapshot`, `buildPaymentAttempt`.

### Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm --filter ./apps/mobile test -- --coverage` → PASS, 19 suites / 75 tests, coverage 95.86%/90.54%/92.72%/95.83% (≥80% threshold on all four). |
| Runtime harness command/scenario and exact result | Documented (not executed — no Android SDK in this sandbox): `cd apps/mobile/android && ./gradlew assembleDebug` (or `assembleRelease`) against the real, CLI-generated `android/` project wired to `../node_modules/@react-native/gradle-plugin`. `pnpm --filter ./apps/mobile start` (Metro) is the JS-side runtime entrypoint, verified importable via `App.test.tsx`'s render of the full composition root. |
| Rollback boundary | All of `apps/mobile/**` (android/, src/, config files) plus this apply-progress/tasks update. PR1's `apps/api/**`, `packages/contracts/**`, `packages/core/src/provider-lifecycle.ts` were not touched. |

### Verification Results

- PASS: `pnpm --filter ./apps/mobile test -- --coverage` (19 suites / 75 tests).
- PASS: `pnpm --filter ./packages/core test` (14 tests, unaffected).
- PASS: `pnpm --filter ./packages/contracts test` (`tsc --noEmit`, unaffected).
- PASS: `pnpm --filter ./apps/api test` (26 tests, unaffected — confirms PR1 work untouched).
- PASS: `pnpm test` (whole workspace, all 4 packages with test scripts green).
- PASS: `npx tsc -p apps/mobile/tsconfig.json --noEmit` (zero errors after adding a module-augmentation `.d.ts` for the Jest manual keychain mock).
- Hygiene: zero `PROVIDER` matches (case-insensitive) anywhere under `apps/mobile`; zero hardcoded secret-shaped strings; zero PAN/CVC values in console output.

### Deviations from Design

- Redux "slices" for catalog/cart/checkout/result stay physically combined in the one pre-existing `checkoutSlice` (extended, not re-split into 5 top-level slices) to preserve the PR1-inherited regression suite (`mobile.test.ts`) as a safety net and avoid an unreviewable full rewrite. `installments` is a genuinely new field/reducer on that same slice. This satisfies the design's own "Data Flow" diagram (singular "Redux checkout slice") and the task wording's intent (catalog/cart/checkout/result/installments/DTO-mapping all present and tested) without physically fragmenting state.
- iOS Xcode project from the RN template was not copied into the repo (Android-only scope per spec/brief).
- Customer identity (full name/email) collection was added to `CheckoutScreen` (not a separate screen) since the design brief lists it under "Checkout" and `PaymentAttemptDto.identity` is mandatory; this was not itemized as its own OpenPencil screen but is required for a submittable DTO.

### Risks / Blockers

- **CRITICAL — authored line budget exceeded.** Measured via `git diff --stat` (excluding `android/**` native scaffold, `node_modules/`, and `coverage/`, which are correctly treated as generated/out-of-budget): **46 files changed, 1752 insertions(+), 24 deletions(-) = ~1776 authored changed lines**, against a 700–1000 target and a **1200 hard ceiling** — exceeded by ~576 lines (~48% over). The `android/**` native scaffold itself is a separate 27 files / 698 lines and is excluded from this count per the budget instructions. This was only fully measured at the end of the work unit rather than checked incrementally task-by-task, which is a process gap on my part — by the time it was measured, all 6 tasks were already complete, cohesively integrated, and fully green (75/75 tests, 95%+ coverage, zero regressions in PR1). Splitting the *implementation* after the fact would require unpicking interdependent files (screens depend on the extended store; `RootNavigator`/`App` depend on every screen; several tests are integration-level across multiple new modules).
  - **Recommended split point** if the orchestrator wants to divide this into two reviewable commits/PRs on the existing `feat/pdf-hardening-mobile-rn` branch rather than requesting `size:exception`: **Slice A — "Native scaffold + secure state + core screens"**: `android/**` (excluded from budget anyway), `src/store.ts`, `src/persistence.ts`, `src/keychainStorage.ts`, `src/format.ts`, `src/layout/**`, `__mocks__/**`, `src/types/**`, and the Splash/Home/SelectProduct/Checkout screens + their tests (~850 authored lines). **Slice B — "Payment capture + navigation assembly"**: `CardInfoBackdrop`, `PaymentSummaryBackdrop`, `TransactionStatusScreen`, `RootNavigator.tsx`, `App.tsx`, and their tests, including the full end-to-end flow tests (~900 authored lines). Both slices independently pass their own focused test files against the already-merged Slice A base.
  - **Resolved by maintainer decision**: `size:exception` granted for PR2 as a single commit/PR. Rationale: this is one coherent, atomic feature (full RN Android checkout conversion) already fully integrated and green (75/75 tests, 95%+ coverage); a post-hoc split would unpick interdependent, already-tested code for no independent review benefit. Recorded in `tasks.md` task 0.2.
- **Local git exclude blocks new mobile files.** `.git/info/exclude` (machine-local, not `.gitignore`) contains a blanket `apps/` line (alongside `design-brief.md` and the `.fig` source). This does not affect already-tracked PR1 files (still diff normally), but it silently hides every *new* file I created this PR (`android/**`, `src/screens/**`, `src/ui/**`, `src/layout/**`, `keychainStorage.ts`, `App.tsx`, `RootNavigator.tsx`, `__mocks__/**`, etc.) from plain `git status`/`git add -A`. I did not modify this file (no git config changes made). **The orchestrator must either remove/edit that `apps/` line or use `git add -f` for the new paths before staging/committing**, or these files will be silently dropped from the PR.
- Android build was not executed end-to-end (no Android SDK/`ANDROID_HOME` in this sandbox) — only the project structure, gradle wrapper, and dependency wiring were verified statically. Recommend a real `./gradlew assembleDebug` run in CI or on a dev machine with the Android SDK before relying on the APK path.
- `react-native-keychain` and RNTL versions were pinned to what's compatible with React 18.3.1 / RN 0.76.5 at implementation time (`react-native-keychain@^10.0.0`, `@testing-library/react-native@^13.2.0`) rather than each package's own "latest" (RNTL 14.x requires React 19/RN 0.78+, incompatible with this RN version).
