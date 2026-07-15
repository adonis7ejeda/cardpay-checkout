# Native Mobile Checkout Specification

## Purpose

Define the Android-capable React Native checkout experience, safe local persistence, and verification expectations.

## Requirements

### Requirement: Android-capable React Native checkout

The mobile client MUST be a real React Native application with an Android project, an APK build path, responsive checkout screens, Redux-managed state, and automated tests for critical checkout behavior.

#### Scenario: Buildable Android app

- GIVEN the mobile project is checked out with documented prerequisites
- WHEN the Android release build command runs
- THEN it MUST produce a documented APK artifact path
- AND the checkout flow MUST remain available in the app.

#### Scenario: Responsive checkout screens

- GIVEN a supported Android device size
- WHEN the user navigates catalog, cart, checkout, confirmation, or failure screens
- THEN the UI MUST preserve usable layout, readable content, and primary actions.

#### Scenario: OpenPencil UI fidelity

- GIVEN `cardpay-checkout-ui-flow.fig` and the documented 8-screen flow are available
- WHEN the React Native checkout screens are reviewed
- THEN they MUST reflect the documented screens, backdrops, states, and responsive boundaries.

### Requirement: Transient card payment submission

The mobile client MUST capture card holder data, PAN, expiry, CVC, customer email, and installments for a payment attempt, and MUST send PAN and CVC only to the backend for immediate provider tokenization. PAN and CVC MUST remain transient and MUST NOT be persisted, logged, rendered after submission, stored in encrypted snapshots, included in delivery metadata, included in transaction records, or returned in error responses.

#### Scenario: Submit card details for backend tokenization

- GIVEN the user enters card details including PAN and CVC
- WHEN the payment attempt DTO is submitted
- THEN the mobile client MUST send PAN, CVC, expiry, holder data, customer email, and installments to the backend over the documented payment endpoint
- AND the mobile client MUST clear transient PAN and CVC after receiving a backend response.

#### Scenario: Installments included in attempt

- GIVEN the user selects an installment count during checkout
- WHEN the payment attempt DTO is submitted
- THEN the DTO MUST include `installments` with the selected value.

#### Scenario: Sensitive fields are transient

- GIVEN the user enters PAN and CVC
- WHEN the checkout flow stores local state or restores a session
- THEN PAN and CVC MUST NOT be present in persisted state.

#### Scenario: Error responses do not restore sensitive fields

- GIVEN backend tokenization or payment creation fails
- WHEN the mobile client displays the failure
- THEN the error state MUST NOT contain PAN or CVC.

### Requirement: Encrypted safe checkout persistence

The mobile client MUST use `react-native-keychain` for encrypted device-backed persistence of safe checkout and catalog snapshot data, and MUST NOT persist PAN, CVC, raw provider credentials, copied tokens, or sponsor-branded values.

#### Scenario: Restore safe snapshot

- GIVEN the app previously stored cart and safe catalog snapshot data
- WHEN the app restarts offline
- THEN it SHOULD restore the safe snapshot without exposing sensitive card data.

#### Scenario: Reject sensitive persistence

- GIVEN checkout data includes PAN or CVC
- WHEN persistence is requested
- THEN the sensitive fields MUST be excluded from storage.
