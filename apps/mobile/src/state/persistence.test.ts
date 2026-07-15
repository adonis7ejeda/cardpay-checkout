import { toSafeSnapshot } from "./persistence";
import type { CheckoutState } from "./store";

const dangerousState: CheckoutState = {
  catalog: [{ id: "sku-1", name: "Wireless Headphones", description: "Noise-isolating audio", unitPrice: { amount: 120000, currency: "COP" }, stockAvailable: 4, purchasable: true }],
  cart: { "sku-1": 1 },
  identity: { fullName: "Ada Lovelace", email: "ada@example.com" },
  fakeCard: { cardholderName: "Ada Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2099", cvc: "123" },
  installments: 6,
  online: true,
  readOnlyCatalog: false
};

describe("toSafeSnapshot", () => {
  it("keeps only catalog, cart, identity, and a timestamp", () => {
    const snapshot = toSafeSnapshot(dangerousState);
    expect(Object.keys(snapshot).sort()).toEqual(["cart", "catalog", "identity", "updatedAt"]);
  });

  it("never includes the raw card number or CVC even when present in state", () => {
    const snapshot = toSafeSnapshot(dangerousState);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("4111111111111111");
    expect(serialized).not.toContain("123");
  });

  it("never includes installments in the persisted snapshot", () => {
    const snapshot = toSafeSnapshot(dangerousState);
    expect(JSON.stringify(snapshot)).not.toContain("installments");
  });
});
