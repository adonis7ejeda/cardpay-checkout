# Provider Transaction Lifecycle Specification

## Purpose

Define provider-safe payment orchestration, transaction states, stock updates, delivery assignment, and local fallback behavior.

## Requirements

### Requirement: Provider card orchestration

The backend MUST execute the provider card flow asynchronously: validate transient card data, tokenize the card with `POST /tokens/cards`, fetch `data.presigned_acceptance.acceptance_token` with `GET /merchants/{PAYMENT_PROVIDER_PUBLIC_KEY}`, create the transaction with `POST /transactions`, then poll `GET /transactions/{providerTransactionId}` until a terminal status or timeout/backoff exhaustion.

#### Scenario: Tokenize without persisting card secrets

- GIVEN a checkout request contains card number, CVC, expiry, and holder name
- WHEN the backend calls `POST /tokens/cards` using `PAYMENT_PROVIDER_PUBLIC_KEY`
- THEN it MUST use the returned card token id and MUST discard PAN and CVC immediately after tokenization.

#### Scenario: Reject invalid card tokenization input safely

- GIVEN a checkout request has invalid PAN, CVC, expiry, or holder data
- WHEN backend validation fails before provider tokenization
- THEN the backend MUST return a safe validation error without PAN or CVC.

#### Scenario: Sensitive card data never leaves transient memory

- GIVEN a checkout request contains PAN and CVC
- WHEN the backend records logs, transaction data, delivery metadata, provider results, or errors
- THEN PAN and CVC MUST NOT be persisted, logged, returned, or copied into those records.

#### Scenario: Create signed card transaction

- GIVEN a card token, acceptance token, customer email, unique reference, COP amount, and installments
- WHEN the backend creates the provider transaction
- THEN it MUST send amount in cents, currency `COP`, `payment_method.type` `CARD`, token, installments, and a SHA256 signature using `PAYMENT_PROVIDER_INTEGRITY_SECRET`.

#### Scenario: Signature uses required concatenation order

- GIVEN reference `R`, amount in cents `A`, currency `COP`, and `PAYMENT_PROVIDER_INTEGRITY_SECRET`
- WHEN the backend generates the transaction `signature`
- THEN it MUST compute SHA256 over exactly `R + A + COP + PAYMENT_PROVIDER_INTEGRITY_SECRET`.

#### Scenario: Swapped signature order is rejected by tests

- GIVEN the same reference, amount, currency, and integrity secret placeholder
- WHEN amount, currency, reference, or secret are concatenated in any other order
- THEN verification tests MUST fail against the expected SHA256 signature.

#### Scenario: Acceptance token retrieval

- GIVEN provider configuration is available through environment variables
- WHEN a payment attempt begins
- THEN the backend MUST fetch the current merchant acceptance token and MUST NOT hardcode it or cache it beyond safe TTL rules specified by design.

### Requirement: Provider-safe transaction lifecycle

The backend MUST create a local PENDING transaction and unique reference before provider transaction creation, treat new provider transactions as initially PENDING, and update local state only after polling reaches a terminal status or retryable timeout.

#### Scenario: Successful approval after polling

- GIVEN a valid checkout request and available stock
- WHEN polling returns provider status `APPROVED`
- THEN the transaction MUST become APPROVED
- AND stock MUST decrement only after approval.

#### Scenario: Provider rejection

- GIVEN polling returns provider status `DECLINED` or `VOIDED`
- WHEN the backend records the result
- THEN the transaction MUST become FAILED with a safe reason.

#### Scenario: Provider technical error

- GIVEN polling returns `ERROR` or exhausts timeout/backoff because of provider technical failure
- WHEN the backend records the result
- THEN the transaction MUST become RETRYABLE and MUST NOT decrement stock.

#### Scenario: Bounded polling exhausted while still PENDING

- GIVEN the provider itself keeps returning `PENDING` (no technical error) and bounded polling reaches its retry limit
- WHEN the backend stops polling
- THEN the transaction MUST remain PENDING (not RETRYABLE), stock reservation MUST stay held, and later confirmation (a follow-up poll, webhook, or manual reconciliation) MUST be able to resolve it to a terminal status without re-creating the reservation.

### Requirement: Delivery assignment metadata

The backend MUST create a delivery assignment after successful payment with deliveryId, status, transactionId, product/cart items, customer name/email, totals, currency, and audit timestamps.

#### Scenario: Assignment after approval

- GIVEN a transaction is APPROVED
- WHEN fulfillment is triggered
- THEN a delivery assignment MUST be recorded with detailed metadata.

#### Scenario: No assignment for unsuccessful payment

- GIVEN a transaction is FAILED or RETRYABLE
- WHEN fulfillment is evaluated
- THEN no delivery assignment or stock decrement MUST occur.

### Requirement: Local fake provider fallback

The backend MUST default locally to in-memory repositories and a fake provider adapter unless real provider and persistence configuration are supplied through environment variables.

#### Scenario: Credential-free local run

- GIVEN no provider credentials are configured
- WHEN the backend starts locally
- THEN it MUST use the fake provider without requiring AWS or raw secrets.
