# Checkout API Specification

## Purpose

Defines backend catalog, stock validation, transaction lifecycle, and payment-provider boundary behavior.

## Requirements

### Requirement: Catalog API

The API MUST expose backend-owned product catalog data including identifiers, prices, display metadata, and stock availability.

#### Scenario: Catalog request succeeds
- GIVEN products exist
- WHEN the mobile app requests the catalog
- THEN the API returns catalog items with current purchasability data

### Requirement: Payment-Time Stock Validation

The API MUST validate stock at payment time before authorizing a transaction.

#### Scenario: Stock is available
- GIVEN requested quantities are available
- WHEN checkout payment is requested
- THEN the API proceeds to payment authorization

#### Scenario: Stock is unavailable
- GIVEN one or more requested quantities exceed stock
- WHEN checkout payment is requested
- THEN the API rejects the transaction before provider authorization

### Requirement: Transaction Lifecycle

The API MUST create, persist, and expose transaction outcomes for successful and failed payment attempts without storing raw card secrets.

#### Scenario: Transaction succeeds
- GIVEN stock is valid and the provider approves payment
- WHEN the payment request completes
- THEN the API persists a successful transaction outcome

#### Scenario: Transaction fails
- GIVEN stock is valid and the provider declines or errors
- WHEN the payment request completes
- THEN the API persists a failed transaction outcome with a safe reason

### Requirement: Generic Payment Provider Boundary

Payment orchestration MUST depend on a generic provider boundary. The first slice MUST use a deterministic fake adapter; real sandbox integration MAY be added later through environment configuration.

#### Scenario: Fake provider is deterministic
- GIVEN a known fake payment input
- WHEN the API authorizes payment through the provider boundary
- THEN the result is deterministic for tests
