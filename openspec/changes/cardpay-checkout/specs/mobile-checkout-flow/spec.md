# Mobile Checkout Flow Specification

## Purpose

Defines the mobile checkout behavior for the verified 8-screen flow, persisted cart resilience, card validation, and transaction outcomes.

## Requirements

### Requirement: Verified Screen Flow

The mobile app MUST present Splash, Products Home, Review Cart, Checkout, Card Info Backdrop, Payment Summary Backdrop, Transaction Success, and Transaction Failure screens using generic payment terminology.

#### Scenario: User completes the screen path
- GIVEN the app has loaded the catalog
- WHEN the customer reviews products, cart, checkout, card entry, and payment summary
- THEN each verified screen/state is reachable in sequence
- AND sponsor-branded names do not appear in UI copy

### Requirement: Backend-Owned Catalog

The mobile app MUST obtain products and stock state from the backend and MUST NOT treat bundled product data as authoritative.

#### Scenario: Catalog loads from backend
- GIVEN network is available
- WHEN the Products Home screen opens
- THEN the displayed catalog reflects the backend response

#### Scenario: Offline catalog read fallback
- GIVEN a prior catalog snapshot exists and network is unavailable
- WHEN the Products Home screen opens
- THEN the app MAY display the persisted snapshot as read-only freshness-limited data

### Requirement: Cart and Checkout Persistence

The app MUST persist cart and checkout state enough to recover interrupted sessions, while payment submission MUST require network.

#### Scenario: Cart survives restart
- GIVEN items were added to cart
- WHEN the app restarts
- THEN the cart and checkout progress are restored

#### Scenario: Offline payment blocked
- GIVEN the device is offline
- WHEN the customer attempts payment submission
- THEN submission is blocked with a recoverable error

### Requirement: Customer Identity Before Payment

Customer name and email MUST be provided and valid before payment summary or payment submission is allowed.

#### Scenario: Missing identity disables payment
- GIVEN name or email is missing or invalid
- WHEN the customer views checkout
- THEN payment progression is disabled with field-level errors

### Requirement: Fake Card Entry Validation

The card form MUST accept fake card data only, validate Luhn, detect Visa/Mastercard, validate expiration, mask CVC, show field errors, and disable submit until valid.

#### Scenario: Valid fake card enables continue
- GIVEN all card fields pass validation
- WHEN the customer finishes card entry
- THEN the continue action is enabled

#### Scenario: Invalid card stays blocked
- GIVEN the card number, expiration, or CVC is invalid
- WHEN the customer edits the card form
- THEN field-level errors are shown and continue remains disabled

### Requirement: Backdrop Cancellation

Card Info and Payment Summary backdrops MUST provide cancel affordances that return the customer to the prior recoverable checkout state.

#### Scenario: Customer cancels a backdrop
- GIVEN the customer is on Card Info or Payment Summary
- WHEN they activate cancel
- THEN the backdrop closes without submitting payment

### Requirement: Outcome Cart Handling

The app MUST clear cart state on successful transaction and MUST preserve cart state on failed transaction.

#### Scenario: Success clears cart
- GIVEN payment succeeds
- WHEN the success screen is shown
- THEN the cart is cleared

#### Scenario: Failure preserves cart
- GIVEN payment fails
- WHEN the failure screen is shown
- THEN the cart remains available for retry
