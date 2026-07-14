/// <reference types="jest" />

import type { CartItemDto } from "@cardpay/contracts";
import {
  calculateCartTotals,
  canPurchaseQuantity,
  detectCardBrand,
  failed,
  isFutureExpiration,
  maskCardNumber,
  maskCvc,
  money,
  nextCartAfterOutcome,
  normalizeQuantity,
  passesLuhn,
  succeeded,
  validateFakeCard,
  validateIdentity,
  mapProviderStatus,
  sanitizeFullName,
  sanitizeCardholderName,
  sanitizeProviderReason,
  shouldApplyFulfillment
} from "./index";
import { createProviderSignature } from "./provider-signature";

const cart: CartItemDto[] = [
  { productId: "p1", quantity: 2, unitPrice: { amount: 1200, currency: "COP" } },
  { productId: "p2", quantity: 1, unitPrice: { amount: 800, currency: "COP" } }
];

describe("pricing rules", () => {
  it("calculates item count and totals in integer minor units", () => {
    expect(calculateCartTotals(cart)).toEqual({
      subtotal: { amount: 3200, currency: "COP" },
      total: { amount: 3200, currency: "COP" },
      itemCount: 3
    });
  });

  it("rejects invalid money values", () => {
    expect(() => money(-1)).toThrow("non-negative integer");
  });
});

describe("provider lifecycle rules", () => {
  it("signs in the required reference, amount, currency, secret order", () => {
    const signature = createProviderSignature("R", 1000, "COP", "test_integrity_secret");
    expect(signature).toBe("52e777b72dd941c857753708d7d18837cd53c3d7ed837b24ac38f557e0f2cd76");
    expect(signature).not.toBe(createProviderSignature("1000R", 0, "COP", "test_integrity_secret"));
  });

  it("maps provider terminal and technical statuses to local lifecycle statuses", () => {
    expect(mapProviderStatus("APPROVED")).toBe("APPROVED");
    expect(mapProviderStatus("DECLINED")).toBe("FAILED");
    expect(mapProviderStatus("VOIDED")).toBe("FAILED");
    expect(mapProviderStatus("ERROR")).toBe("RETRYABLE");
    expect(mapProviderStatus("timeout")).toBe("RETRYABLE");
    expect(mapProviderStatus("PENDING")).toBe("PENDING");
  });

  it("keeps sensitive card data out of provider-safe reasons", () => {
    expect(sanitizeProviderReason("card 4111111111111111 cvc=123 declined")).toBe("card [redacted-card] cvc [redacted] declined");
    expect(sanitizeProviderReason("card 4111 1111 1111 1111 was declined")).toBe("card [redacted-card] was declined");
    expect(sanitizeProviderReason("card 4111-1111-1111-1111 was declined")).toBe("card [redacted-card] was declined");
  });

  it("allows stock and delivery only after approval", () => {
    expect(shouldApplyFulfillment("APPROVED")).toBe(true);
    expect(shouldApplyFulfillment("FAILED")).toBe(false);
    expect(shouldApplyFulfillment("RETRYABLE")).toBe(false);
  });
});

describe("quantity rules", () => {
  it("clamps quantities to available stock", () => {
    expect(normalizeQuantity(0, 5)).toBe(1);
    expect(normalizeQuantity(9, 5)).toBe(5);
    expect(normalizeQuantity(2.5, 5)).toBe(1);
  });

  it("validates purchasable quantities", () => {
    expect(canPurchaseQuantity(2, 2)).toBe(true);
    expect(canPurchaseQuantity(3, 2)).toBe(false);
  });
});

describe("identity rules", () => {
  it("requires a name and valid email", () => {
    expect(validateIdentity({ fullName: "Ada Lovelace", email: "ada@example.com" }).valid).toBe(true);
    expect(validateIdentity({ fullName: " ", email: "bad" })).toEqual({
      valid: false,
      errors: { fullName: "Full name is required", email: "Valid email is required" }
    });
  });

  it("rejects a full name containing digits", () => {
    expect(validateIdentity({ fullName: "Ada4 Lovelace", email: "ada@example.com" })).toEqual({
      valid: false,
      errors: { fullName: "Full name can only contain letters and spaces" }
    });
  });

  it("strips digits out of a full name as the user types", () => {
    expect(sanitizeFullName("Ada4 Lovelace2")).toBe("Ada Lovelace");
    expect(sanitizeFullName("O'Brien-Smith")).toBe("O'Brien-Smith");
  });
});

describe("card rules", () => {
  const today = new Date("2026-01-15T00:00:00Z");

  it("detects supported fake card brands and Luhn validity", () => {
    expect(detectCardBrand("4111 1111 1111 1111")).toBe("visa");
    expect(detectCardBrand("5555 5555 5555 4444")).toBe("mastercard");
    expect(passesLuhn("4111 1111 1111 1111")).toBe(true);
    expect(passesLuhn("4111 1111 1111 1112")).toBe(false);
  });

  it("validates future expiration", () => {
    expect(isFutureExpiration("12", "26", today)).toBe(true);
    expect(isFutureExpiration("01", "25", today)).toBe(false);
    expect(isFutureExpiration("13", "26", today)).toBe(false);
  });

  it("validates complete fake card input", () => {
    expect(
      validateFakeCard(
        { cardholderName: "Ada Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2026", cvc: "123" },
        today
      )
    ).toEqual({ valid: true, brand: "visa", errors: {} });

    expect(
      validateFakeCard({ cardholderName: "", number: "123", expirationMonth: "01", expirationYear: "2025", cvc: "x" }, today).valid
    ).toBe(false);
  });

  it("rejects a cardholder name containing digits", () => {
    expect(
      validateFakeCard(
        { cardholderName: "Ada4 Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2026", cvc: "123" },
        today
      ).errors.cardholderName
    ).toBe("Cardholder name can only contain letters and spaces");
  });

  it("strips digits out of a cardholder name as the user types", () => {
    expect(sanitizeCardholderName("Ada4 Lovelace2")).toBe("Ada Lovelace");
  });

  it("rejects a card number containing letters even if it would otherwise pass Luhn", () => {
    expect(
      validateFakeCard(
        { cardholderName: "Ada Lovelace", number: "411a111111111111b1", expirationMonth: "12", expirationYear: "2026", cvc: "123" },
        today
      ).errors.number
    ).toBe("Card number can only contain digits");
  });
});

describe("masking and outcome rules", () => {
  it("masks card number and CVC for display", () => {
    expect(maskCardNumber("4111111111111111")).toBe("•••• •••• •••• 1111");
    expect(maskCvc("123")).toBe("•••");
  });

  it("clears cart only after success", () => {
    expect(nextCartAfterOutcome(succeeded("txn_1"), cart)).toEqual([]);
    expect(nextCartAfterOutcome(failed("txn_2", "payment_declined", true), cart)).toEqual(cart);
  });
});
