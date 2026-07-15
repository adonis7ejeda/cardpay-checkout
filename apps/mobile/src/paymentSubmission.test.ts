import { failed, succeeded } from "@cardpay/core";
import type { CatalogItemDto, FakeCardInputDto, TransactionResultDto } from "@cardpay/contracts";
import { buildPaymentAttempt, checkoutActions, createCheckoutStore, submitPayment } from "./state/store";
import type { ApiClient } from "./ports";

const catalog: CatalogItemDto[] = [
  { id: "sku-1", name: "Wireless Headphones", description: "Noise-isolating audio", unitPrice: { amount: 120000, currency: "COP" }, stockAvailable: 4, purchasable: true }
];
const validCard: FakeCardInputDto = { cardholderName: "Ada Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2099", cvc: "123" };

function readyStore() {
  return createCheckoutStore({ catalog, cart: { "sku-1": 2 }, identity: { fullName: "Ada Lovelace", email: "ada@example.com" }, fakeCard: validCard });
}

function api(result: TransactionResultDto): ApiClient {
  return { fetchCatalog: jest.fn(async () => catalog), submitPayment: jest.fn(async () => result), getTransactionStatus: jest.fn(async () => result) };
}

describe("installments selection is included in the payment attempt DTO", () => {
  it("defaults installments to 1", () => {
    const store = readyStore();
    expect(buildPaymentAttempt(store.getState().checkout).installments).toBe(1);
  });

  it("reflects a user-selected installment count", () => {
    const store = readyStore();
    store.dispatch(checkoutActions.setInstallments(6));
    expect(buildPaymentAttempt(store.getState().checkout).installments).toBe(6);
  });

  it("submits the selected installments value with the payment attempt", async () => {
    const store = readyStore();
    store.dispatch(checkoutActions.setInstallments(12));
    const client = api(succeeded("txn-ok"));
    await submitPayment(store, client, new Date("2026-01-01"));
    expect(client.submitPayment).toHaveBeenCalledWith(expect.objectContaining({ installments: 12 }));
  });
});

describe("transient PAN/CVC clearing after a backend response", () => {
  it("clears the fake card fields after a successful payment", async () => {
    const store = readyStore();
    await submitPayment(store, api(succeeded("txn-ok")), new Date("2026-01-01"));
    const { fakeCard } = store.getState().checkout;
    expect(fakeCard).toEqual({ cardholderName: "", number: "", expirationMonth: "", expirationYear: "", cvc: "" });
  });

  it("clears the fake card fields after a failed payment and keeps the error PAN/CVC-free", async () => {
    const store = readyStore();
    await submitPayment(store, api(failed("txn-no", "payment_declined", true)), new Date("2026-01-01"));
    const state = store.getState().checkout;
    expect(state.fakeCard).toEqual({ cardholderName: "", number: "", expirationMonth: "", expirationYear: "", cvc: "" });
    expect(JSON.stringify(state.lastResult)).not.toContain(validCard.number);
    expect(JSON.stringify(state.lastResult)).not.toContain(validCard.cvc);
  });
});

describe("network/backend transport failure during submission", () => {
  it("surfaces a retry-safe error and does not throw when the backend is unreachable", async () => {
    const store = readyStore();
    const client: ApiClient = { fetchCatalog: jest.fn(async () => catalog), submitPayment: jest.fn(async () => { throw new Error("network down"); }), getTransactionStatus: jest.fn() };

    const result = await submitPayment(store, client, new Date("2026-01-01"));

    expect(result).toBeNull();
    const state = store.getState().checkout;
    expect(state.error).toBe("We could not reach the payment service. Please try again.");
    expect(state.lastResult).toBeUndefined();
  });

  it("keeps the entered card data intact after a transport failure so the user does not retype it", async () => {
    const store = readyStore();
    const client: ApiClient = { fetchCatalog: jest.fn(async () => catalog), submitPayment: jest.fn(async () => { throw new Error("timeout"); }), getTransactionStatus: jest.fn() };

    await submitPayment(store, client, new Date("2026-01-01"));

    expect(store.getState().checkout.fakeCard).toEqual(validCard);
  });
});
