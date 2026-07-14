import { failed, succeeded } from "@cardpay/core";
import type { CatalogItemDto, FakeCardInputDto, PaymentAttemptDto, TransactionResultDto } from "@cardpay/contracts";
import { BackdropShell, CardForm, PaymentSummary, ProductCard, TransactionStatus } from "./components";
import { HttpApiClient } from "./api";
import { cancelBackdrop, checkoutScreens, nextScreen } from "./navigation";
import { loadCheckoutSnapshot, MemorySecureStorage } from "./persistence";
import { canContinueToPayment, checkoutActions, createCheckoutStore, loadCatalog, persistCheckout, selectCartTotals, submitPayment } from "./store";
import type { ApiClient } from "./types";

const catalog: CatalogItemDto[] = [{ id: "sku-1", name: "Wireless Headphones", description: "Noise-isolating audio", unitPrice: { amount: 120000, currency: "COP" }, stockAvailable: 4, purchasable: true }];
const validCard: FakeCardInputDto = { cardholderName: "Ada Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2099", cvc: "123" };
const validPaymentAttempt: PaymentAttemptDto = {
  identity: { fullName: "Ada Lovelace", email: "ada@example.com" },
  cartItems: [{ productId: "sku-1", quantity: 2, unitPrice: catalog[0].unitPrice }],
  totals: { subtotal: { amount: 240000, currency: "COP" }, total: { amount: 240000, currency: "COP" }, itemCount: 2 },
  card: validCard,
  installments: 1
};

function api(result: TransactionResultDto = succeeded("txn-1"), items = catalog): ApiClient {
  return { fetchCatalog: jest.fn(async () => items), submitPayment: jest.fn(async () => result) };
}

function readyStore() {
  const store = createCheckoutStore({ catalog, cart: { "sku-1": 2 }, identity: { fullName: "Ada Lovelace", email: "ada@example.com" }, fakeCard: validCard });
  return store;
}

describe("mobile checkout shell", () => {
  it("exposes the verified 8-screen path with backdrop cancellation", () => {
    expect(checkoutScreens).toEqual(["Splash", "Products", "Cart", "Checkout", "CardInfo", "PaymentSummary", "TransactionSuccess", "TransactionFailure"]);
    expect(nextScreen("Splash")).toBe("Products");
    expect(nextScreen("PaymentSummary", "succeeded")).toBe("TransactionSuccess");
    expect(nextScreen("TransactionFailure")).toBe("TransactionFailure");
    expect(nextScreen("PaymentSummary", "failed")).toBe("TransactionFailure");
    expect(cancelBackdrop("CardInfo")).toBe("Checkout");
    expect(cancelBackdrop("Products")).toBe("Products");
    expect(BackdropShell("Card details", true)).toEqual({ title: "Card details", open: true, cancelLabel: "Cancel" });
  });

  it("loads catalog from the backend client", async () => {
    const store = createCheckoutStore();
    await loadCatalog(store, api(), new MemorySecureStorage());
    expect(store.getState().checkout.catalog[0]?.name).toBe("Wireless Headphones");
    expect(ProductCard(catalog[0], 1).stock.label).toBe("4 available");
    expect(ProductCard({ ...catalog[0], stockAvailable: 0 }).stock.available).toBe(false);
  });

  it("wraps the HTTP catalog and transaction endpoints", async () => {
    const fetcher = jest.fn(async (url: string) => ({ ok: true, json: async () => (url.endsWith("/catalog") ? catalog : succeeded("txn-http")) })) as unknown as typeof fetch;
    const client = new HttpApiClient("https://api.example.test", fetcher);
    await expect(client.fetchCatalog()).resolves.toEqual(catalog);
    await expect(client.submitPayment(validPaymentAttempt)).resolves.toEqual(succeeded("txn-http"));
    expect(fetcher).toHaveBeenLastCalledWith("https://api.example.test/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validPaymentAttempt)
    });
  });

  it("fails safely when HTTP responses are unavailable", async () => {
    const fetcher = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    const client = new HttpApiClient("https://api.example.test", fetcher);
    await expect(client.fetchCatalog()).rejects.toThrow("Catalog is unavailable");
    await expect(client.submitPayment(validPaymentAttempt)).rejects.toThrow("Payment submission is unavailable");
  });

  it("uses an offline snapshot as read-only catalog fallback", async () => {
    const storage = new MemorySecureStorage();
    const store = readyStore();
    await persistCheckout(store, storage);
    const restarted = createCheckoutStore();
    await loadCatalog(restarted, { ...api(), fetchCatalog: jest.fn(async () => { throw new Error("offline"); }) }, storage);
    expect(restarted.getState().checkout.readOnlyCatalog).toBe(true);
    expect(selectCartTotals(restarted.getState().checkout).total.amount).toBe(240000);
  });

  it("fails catalog load without network or snapshot", async () => {
    const store = createCheckoutStore();
    await expect(loadCatalog(store, { ...api(), fetchCatalog: jest.fn(async () => { throw new Error("offline"); }) }, new MemorySecureStorage())).rejects.toThrow("Catalog is unavailable and no snapshot exists");
  });

  it("recovers cart and checkout identity after restart", async () => {
    const storage = new MemorySecureStorage();
    const store = readyStore();
    await persistCheckout(store, storage);
    const snapshot = await loadCheckoutSnapshot(storage);
    expect(snapshot?.cart).toEqual({ "sku-1": 2 });
    expect(snapshot?.identity.email).toBe("ada@example.com");
  });

  it("updates checkout fields through Redux actions", () => {
    const store = createCheckoutStore({ catalog });
    store.dispatch(checkoutActions.setQuantity({ productId: "sku-1", quantity: 1 }));
    store.dispatch(checkoutActions.setQuantity({ productId: "missing", quantity: 1 }));
    store.dispatch(checkoutActions.setIdentity({ fullName: "Grace Hopper", email: "grace@example.com" }));
    store.dispatch(checkoutActions.setFakeCard(validCard));
    expect(selectCartTotals(store.getState().checkout).itemCount).toBe(1);
    store.dispatch(checkoutActions.setQuantity({ productId: "sku-1", quantity: 0 }));
    expect(store.getState().checkout.cart).toEqual({ missing: 1 });
  });

  it("blocks payment while offline", async () => {
    const store = readyStore();
    store.dispatch(checkoutActions.setOnline(false));
    await expect(submitPayment(store, api(), new Date("2026-01-01"))).resolves.toBeNull();
    expect(store.getState().checkout.error).toBe("Connect to the internet before paying");
  });

  it("blocks payment when checkout data is incomplete", async () => {
    const store = createCheckoutStore({ catalog, cart: { "sku-1": 1 }, identity: { fullName: "", email: "" }, fakeCard: validCard });
    await expect(submitPayment(store, api(), new Date("2026-01-01"))).resolves.toBeNull();
    expect(store.getState().checkout.error).toBe("Complete valid checkout details before paying");
  });

  it("reports missing identity errors and disables payment summary", () => {
    const summary = PaymentSummary({ fullName: "", email: "bad" }, [{ productId: "sku-1", quantity: 1, unitPrice: catalog[0].unitPrice }]);
    expect(summary.identityErrors).toEqual({ fullName: "Full name is required", email: "Valid email is required" });
    expect(summary.payButton.disabled).toBe(true);
    expect(PaymentSummary({ fullName: "Ada Lovelace", email: "ada@example.com" }, []).payButton.disabled).toBe(true);
  });

  it("keeps invalid card data blocked", () => {
    const form = CardForm({ ...validCard, number: "123", cvc: "1" }, new Date("2026-01-01"));
    expect(form.errors.number).toBe("Valid fake Visa or Mastercard number is required");
    expect(form.continueButton.disabled).toBe(true);
    expect(CardForm(validCard, new Date("2026-01-01")).continueButton.disabled).toBe(false);
  });

  it("clears cart on success and preserves cart on failure", async () => {
    const successStore = readyStore();
    await submitPayment(successStore, api(succeeded("txn-ok")), new Date("2026-01-01"));
    expect(successStore.getState().checkout.cart).toEqual({});
    expect(TransactionStatus(successStore.getState().checkout.lastResult!).title).toBe("Payment approved");

    const failureStore = readyStore();
    await submitPayment(failureStore, api(failed("txn-no", "payment_declined", true)), new Date("2026-01-01"));
    expect(failureStore.getState().checkout.cart).toEqual({ "sku-1": 2 });
    expect(TransactionStatus(failureStore.getState().checkout.lastResult!).retryable).toBe(true);
  });

  it("submits selected cart items and totals with the payment attempt", async () => {
    const store = readyStore();
    const client = api(succeeded("txn-ok"));
    await submitPayment(store, client, new Date("2026-01-01"));
    expect(client.submitPayment).toHaveBeenCalledWith(validPaymentAttempt);
  });

  it("allows payment only when identity, fake card, cart, and network are valid", () => {
    expect(canContinueToPayment(readyStore().getState().checkout, new Date("2026-01-01"))).toBe(true);
  });
});
