# Shared Payment Contracts Specification

## Purpose

Defines shared DTOs and validation contracts used by mobile and API so checkout behavior stays aligned.

## Requirements

### Requirement: Catalog and Cart Contracts

Shared contracts MUST define catalog item, cart item, quantity, price, and totals shapes consumed by both mobile and API.

#### Scenario: Cart payload is accepted
- GIVEN the mobile app submits cart items using shared contracts
- WHEN the API validates the request
- THEN identifiers, quantities, prices, and totals have compatible shapes

### Requirement: Checkout Identity Contract

Shared checkout contracts MUST require customer name and valid email before payment submission.

#### Scenario: Identity is valid
- GIVEN name and email satisfy the shared contract
- WHEN checkout is submitted
- THEN the payload is eligible for backend validation

#### Scenario: Identity is invalid
- GIVEN name or email violates the shared contract
- WHEN checkout is submitted
- THEN validation fails before payment authorization

### Requirement: Payment Safety Contract

Shared contracts MUST model only fake card validation inputs on the client boundary and MUST NOT include raw secrets, private keys, or provider credentials.

#### Scenario: Contract excludes provider secrets
- GIVEN payment DTOs are reviewed
- WHEN checking persisted or transferred fields
- THEN no full API key, password, private key, or provider credential field is present

### Requirement: Transaction Result Contract

Shared contracts MUST define success and failure result shapes with safe status, transaction identifier, and customer-safe message fields.

#### Scenario: Failure result preserves recovery path
- GIVEN payment fails
- WHEN the API returns a failure result
- THEN the mobile app can show failure while preserving the cart
