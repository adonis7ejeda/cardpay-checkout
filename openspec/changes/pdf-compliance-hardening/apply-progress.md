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
