import { cancelBackdrop, nextScreen, previousScreen } from "./navigation";

describe("previousScreen", () => {
  it("returns Products from Cart", () => {
    expect(previousScreen("Cart")).toBe("Products");
  });

  it("returns Cart from Checkout", () => {
    expect(previousScreen("Checkout")).toBe("Cart");
  });

  it("returns the same screen for anywhere without a defined back target", () => {
    expect(previousScreen("Products")).toBe("Products");
    expect(previousScreen("CardInfo")).toBe("CardInfo");
  });
});

describe("nextScreen", () => {
  it("advances linearly through the checkout flow", () => {
    expect(nextScreen("Products")).toBe("Cart");
    expect(nextScreen("Cart")).toBe("Checkout");
    expect(nextScreen("Checkout")).toBe("CardInfo");
  });

  it("routes PaymentSummary to success or failure based on outcome", () => {
    expect(nextScreen("PaymentSummary", "succeeded")).toBe("TransactionSuccess");
    expect(nextScreen("PaymentSummary", "failed")).toBe("TransactionFailure");
    expect(nextScreen("PaymentSummary")).toBe("TransactionSuccess");
  });
});

describe("cancelBackdrop", () => {
  it("returns Checkout from CardInfo and PaymentSummary", () => {
    expect(cancelBackdrop("CardInfo")).toBe("Checkout");
    expect(cancelBackdrop("PaymentSummary")).toBe("Checkout");
  });

  it("returns the same screen when there is no backdrop to cancel", () => {
    expect(cancelBackdrop("Products")).toBe("Products");
  });
});
