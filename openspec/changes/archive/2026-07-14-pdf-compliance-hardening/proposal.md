# Proposal: PDF Compliance Hardening

## Intent

Close the remaining delivery gaps by turning the checkout demo into a real Android-capable mobile app, provider-ready backend, and AWS-deployable service without exposing raw credentials or sponsor branding.

## Scope

### In Scope
- Replace the mobile shell with a real React Native app including Android project and APK path.
- Add encrypted mobile persistence for recoverable checkout/cart state.
- Add backend provider adapter behind a port, driven by environment/secrets, with fake local fallback.
- Add strict transaction lifecycle: create PENDING transaction/number before provider call, authorize, update result, assign product for delivery, and decrement stock only after successful payment.
- Add DynamoDB persistence for AWS, in-memory default locally, and optional DynamoDB Local via Docker/Compose using `DYNAMODB_ENDPOINT`.
- Add AWS Lambda/API Gateway deployment path plus backend Dockerfile/Compose for local parity.
- Update README evidence and hygiene scans for secrets, branding, APK, local, and cloud paths.

### Out of Scope
- iOS delivery, production merchant onboarding, and non-generic provider branding.
- Persisting or documenting any raw provider credential values.

## Capabilities

### New Capabilities
- `cloud-deployment`: Lambda/API Gateway, DynamoDB, environment/secret configuration, Docker, and local parity.

### Modified Capabilities
- `mobile-checkout-flow`: Native Android project, APK build path, and encrypted persistence.
- `checkout-api`: Real provider adapter, strict transaction lifecycle, delivery assignment, stock decrement, and DynamoDB repository option.
- `shared-payment-contracts`: Transaction number, safe provider request/result, assignment metadata, and no-secret DTO boundaries.
- `delivery-verification`: README evidence, hygiene scans, chained delivery, and cloud/local verification.

## Approach

Use forced feature-branch-chain slices: API hardening, mobile native app, deployment/runtime parity, then verification. Keep local defaults credential-free with in-memory repositories and fake provider; enable DynamoDB Local with `DYNAMODB_ENDPOINT`; use real DynamoDB and secret/env-configured provider credentials in AWS.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/mobile/` | Modified | React Native CLI app, Android project, encrypted persistence |
| `apps/api/` | Modified | Ports/adapters, lifecycle, DynamoDB repositories, Lambda entry |
| `packages/contracts/` | Modified | Safe transaction/provider/assignment contracts |
| `packages/core/` | Modified | State transition and post-payment stock/delivery rules |
| `Dockerfile`, `docker-compose.yml`, `infra/` | New | Local parity and AWS deployment assets |
| `README.md` | Modified | Run, deploy, APK, evidence, and hygiene guidance |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Review size from Android/infra scaffolds | High | Forced chained PRs within 800-line budget |
| Secret or branding leakage | Med | Env-only config, fake defaults, hygiene scans |
| Local/AWS behavior drift | Med | Shared ports plus DynamoDB Local integration path |

## Rollback Plan

Revert chain slices in reverse order. Disable AWS deployment by removing stack/env configuration; local API falls back to in-memory repositories and fake provider.

## Dependencies

- AWS account/permissions for deployment validation.
- Provider sandbox credentials supplied only through secrets/environment variables.
- Android build tooling for APK generation.

## Success Criteria

- [ ] Android APK path builds from the React Native project.
- [ ] Local backend runs without AWS credentials and uses fake provider by default.
- [ ] AWS path uses Lambda/API Gateway, DynamoDB, and env/secret provider config.
- [ ] Payment success follows PENDING → provider → SUCCESS → assign → decrement stock.
- [ ] README and scans prove no raw credentials or sponsor branding were persisted.
