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
  validateIdentity
} from "./index";

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
