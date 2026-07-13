## Exploration: cardpay-checkout

### Current State
The repository is still design-only: PDF requirements, a design brief, OpenPencil assets, and SDD bootstrap files exist, but there is no app/backend source tree, package manifest, or test harness yet. This time the OpenPencil desktop file was live-inspected, so the UI scope is now verified rather than inferred.

### Design Inspection Findings
- The current page is `cardpay-checkout UI Flow` with a root frame sized `6432×1533`.
- The verified flow contains 8 mobile screens: Splash, Products Home, Review Cart, Checkout, Card Info Backdrop, Payment Summary Backdrop, Transaction Success, and Transaction Failure.
- Spacing is 8px-compliant; no off-grid gaps or paddings were reported.
- The design is not componentized in OpenPencil, but it clearly maps to implementation components such as `ProductCard`, `StockBadge`, `QuantityStepper`, `CartSummary`, `SummaryRow`, `PrimaryButton`, `BackdropShell`, `CardForm`, `PaymentSummary`, and `TransactionStatus`.
- Only minor cosmetic warnings were reported (nested radii / padding variance); nothing blocks implementation.
- Placeholder media and labels are used in the design, so implementation should rely on deterministic local placeholders instead of emoji-only or network-dependent artwork.
- Card/payment backdrop screens require explicit cancel controls, and card entry must mask CVC.

### Affected Areas
- `apps/mobile/` — new React Native app for the verified 8-screen checkout flow and backdrop states.
- `apps/api/` — new TypeScript + Nest.js backend for transaction orchestration and payment provider integration.
- `packages/contracts/` — shared DTOs/types for cart, checkout, payment, and terminal result payloads.
- `packages/core/` or `packages/shared/` — shared pure logic for pricing, stock validation, masking rules, and transaction state.
- `README.md` — run/test/build instructions plus coverage evidence.
- `Dockerfile` / deployment config — backend readiness if cloud delivery is skipped.

### Approaches
1. **Monorepo with shared contracts + hexagonal backend** — one repo with `apps/mobile`, `apps/api`, and shared packages; backend modules stay thin and talk to payment/stock adapters through ports.
   - Pros: best fit for chained PRs, shared DTOs, verified UI-to-contract alignment, stronger testability.
   - Cons: more initial setup, workspace/tooling decisions must be made early.
   - Effort: Medium

2. **Flat split apps with minimal shared code** — separate mobile and backend folders, duplicate some types, keep backend mostly feature-based modules.
   - Pros: fastest bootstrap, fewer workspace concepts up front.
   - Cons: more drift between layers, weaker contract consistency, harder to preserve the verified UI flow across boundaries.
   - Effort: Low

### Recommendation
Use the monorepo approach with shared contracts and a clean/hexagonal backend. The verified OpenPencil flow now gives a stable screen map, so the proposal should lean on that evidence and focus on foundation + implementation slices instead of design discovery.

Suggested first slices:
1. Repo/workspace bootstrap + shared contracts + README scaffold.
2. Mobile shell: state, product list/cart/checkout navigation, and the verified backdrop/result screens.
3. Backend shell: transaction create/update flow, payment provider adapter port, stock update use case.
4. Validation/tests/docs: card validation, happy/unhappy flows, coverage gate, build artifact notes, Dockerfile if cloud is skipped.

### Risks
- The source tree is empty, so the first proposal must include foundational setup work before feature delivery.
- The payment flow must never persist raw credentials; secrets need env vars and secure storage boundaries.
- The verified design still uses placeholders, so implementation must avoid brittle assets or emoji-only fallbacks.
- Coverage requirements are high on both mobile and backend, so pure UI work without shared testable logic will miss the target.

### Ready for Proposal
Yes — the scope is now verified enough to draft the proposal with the OpenPencil flow as the source of truth.

## Phase Envelope
- status: ready_for_proposal
- executive_summary: The repo is still empty aside from design/spec bootstrap files, but the OpenPencil UI flow is now verified with 8 screens, so the change should start with a monorepo foundation and shared contracts, then implement the mobile checkout flow and Nest.js transaction/payment flow in reviewable slices.
- artifacts: `openspec/changes/cardpay-checkout/exploration.md`, Engram topic `sdd/cardpay-checkout/explore`
- next_recommended: Draft the proposal using the verified 8-screen OpenPencil flow, then slice implementation into bootstrap, mobile, backend, and verification PRs.
- risks: Missing source tree, secure handling of payment secrets, deterministic placeholder assets, and the dual 80% coverage targets are the main schedule risks.
- skill_resolution: loaded `sdd-explore`, `cognitive-doc-design`, `work-unit-commits`, and `chained-pr`; persistence mode is hybrid (OpenSpec + Engram).
