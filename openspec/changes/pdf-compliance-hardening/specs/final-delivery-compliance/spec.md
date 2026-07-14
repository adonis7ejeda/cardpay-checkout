# Final Delivery Compliance Specification

## Purpose

Define evidence, hygiene, coverage, and PR-readiness expectations for final delivery.

## Requirements

### Requirement: Public-ready delivery evidence

The repository MUST document local run, optional DynamoDB Local, AWS deployment, APK build path, verification commands, OpenPencil UI source-of-truth evidence, and evidence results using generic payment-provider terminology only.

#### Scenario: README evidence is complete

- GIVEN a reviewer opens the repository README
- WHEN they follow the documented local, APK, and cloud sections
- THEN they MUST find commands, expected outputs or artifact paths, and secret-handling guidance.

#### Scenario: Missing evidence blocks release

- GIVEN APK, cloud, local, or coverage evidence is absent
- WHEN final verification is performed
- THEN the change MUST NOT be marked delivery-ready.

### Requirement: Hygiene and coverage gates

The final delivery MUST include tests or documented verification for mobile checkout, provider lifecycle, transient PAN/CVC handling, signature order, persistence adapters, deployment configuration, and secret/branding hygiene.

#### Scenario: Hygiene scan passes

- GIVEN generated and committed artifacts are scanned
- WHEN no raw provider credentials, API keys, copied tokens, PAN/CVC persistence, PAN/CVC logs, PAN/CVC responses, or sponsor names are found
- THEN the repository MAY be considered public-ready for review.

#### Scenario: Sensitive payment regression tests pass

- GIVEN checkout and provider lifecycle tests are executed
- WHEN they validate tokenization, persistence, error responses, and transaction records
- THEN they MUST prove PAN/CVC remain transient and signature generation uses the required concatenation order.

#### Scenario: Coverage evidence

- GIVEN tests and build checks are executed
- WHEN results are collected
- THEN the final evidence MUST report coverage or explain unavailable tooling explicitly.

### Requirement: Chained PR readiness

The implementation MUST be prepared for a feature-branch-chain review strategy with focused slices targeting 700-1000 changed lines and a hard maximum of 1200 changed lines per PR unless a maintainer explicitly accepts a size exception.

#### Scenario: Review slice boundary

- GIVEN a PR slice is prepared
- WHEN reviewers inspect it
- THEN it MUST state scope, changed-line count, dependency, verification, and out-of-scope follow-up work.

#### Scenario: Oversized slice blocked

- GIVEN a PR slice exceeds 1200 changed lines without an accepted size exception
- WHEN final delivery readiness is evaluated
- THEN the slice MUST be split before review.
