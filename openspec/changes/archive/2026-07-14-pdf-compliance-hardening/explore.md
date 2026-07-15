## Exploration: PDF compliance hardening

### Current State
The repo already has a pnpm monorepo, a Nest API, shared contracts/core rules, and a TypeScript mobile checkout shell. The hard blockers are still real: `apps/mobile` has no native Android project/APK path, persistence is JSON-only rather than encrypted, `apps/api` still uses a deterministic fake payment provider with in-memory stock/transactions, there is no strict PENDING→authorize→update lifecycle, no delivery assignment/stock decrement after success, and no backend Dockerfile or AWS deployment scaffold.

### Affected Areas
- `apps/mobile/` — must become a real React Native CLI app with Android project, secure persistence, and APK output path.
- `apps/api/` — must gain env-driven real provider integration, strict transaction lifecycle, delivery assignment, and post-payment stock updates.
- `packages/contracts/` — may need safe transaction/request/result shapes for transaction numbers, assignment metadata, and provider-safe payloads.
- `packages/core/` — may need pure helpers for encrypted-safe persistence rules, transaction state transitions, and post-payment cart/stock outcomes.
- `README.md` — must document local run/build, APK path, secrets handling, and deployment path.
- `Dockerfile` / deployment config — needed for local container parity and/or cloud delivery.
- `openspec/changes/pdf-compliance-hardening/*` — proposal/spec/tasks follow-up should capture the hardening slice.

### Approaches
1. **Full React Native CLI replacement under `apps/mobile`** — replace the TS shell with a real RN app, keep shared TS domain logic, and add the Android project so an APK can be built from `android/`.
   - Pros: satisfies the PDF requirement directly, gives a real APK path, preserves shared testable logic, and keeps the current checkout flow as the source of truth.
   - Cons: biggest setup cost, more generated files, and the Android scaffold can inflate review size fast.
   - Effort: High

2. **Provider adapter behind a port with env vars, plus deterministic fake/local adapter for tests** — add a real payment-provider adapter only at the boundary, keep the existing fake adapter for deterministic tests, and never hardcode credentials.
   - Pros: preserves local backend usability, keeps tests deterministic, and makes secret handling explicit and safe.
   - Cons: requires careful transaction-state wiring and more orchestration code.
   - Effort: Medium

3. **Lambda/API Gateway deployment via CDK, with a Dockerfile kept for local/container parity** — deploy the Nest API as a Node Lambda for free-tier friendliness while keeping `docker build/run` available locally.
   - Pros: best cost control, no always-on container bill, and local dev can stay on `start:dev` or Docker.
   - Cons: more infra plumbing than a plain container host, and the Lambda adapter adds another integration surface.
   - Effort: Medium

### Recommendation
Use the full RN CLI app replacement, an env-driven real provider adapter with a deterministic fake/local test adapter, and Lambda/API Gateway for AWS with a Dockerfile retained for local/container use. That combination is the smallest path that still satisfies the PDF: real mobile + APK, safe provider integration, strict transaction lifecycle, encrypted persistence, and a free-tier-oriented deployment story.

Recommended implementation slices for a forced chain:
1. **API hardening slice** — PENDING transaction creation, transaction number generation, provider port/env config, delivery assignment, stock decrement on success, and tests.
2. **Mobile native slice** — RN CLI scaffold, Android project, encrypted persistence boundary, and reuse of the current checkout state logic/components.
3. **Deployment slice** — Dockerfile plus AWS CDK/Lambda wiring and README updates for local dev, cloud deploy, and APK generation.
4. **Verification slice** — secret/branding hygiene, build/run commands, and updated OpenSpec evidence.

### Risks
- Android scaffold and deployment plumbing can blow past the 800-line review budget unless split aggressively.
- Real-provider integration can leak secrets if the boundary is not env-only and logs are not scrubbed.
- Lambda deployment may need an adapter layer that changes the runtime entrypoint, so local behavior must be kept separate and well-tested.
- Secure mobile persistence needs device-backed encryption; plain redux-persist is not enough.

### Ready for Proposal
Yes — the scope is clear enough to draft a proposal and then split implementation into chained slices. The main question for the user is whether they want the AWS path to be Lambda/API Gateway first (recommended) or container-first via App Runner if they value deployment simplicity over strict free-tier cost control.
