import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import type { CatalogItemDto, TransactionResultDto } from "@cardpay/contracts";
import { succeeded, failed } from "@cardpay/core";
import { RootNavigator } from "./RootNavigator";
import { createCheckoutStore } from "../state/store";
import type { ApiClient, SecureStorageBoundary } from "../ports";
import { MemorySecureStorage } from "../state/persistence";

const catalog: CatalogItemDto[] = [
  { id: "sku-1", name: "Wireless Headphones", description: "Noise-isolating audio", unitPrice: { amount: 120000, currency: "COP" }, stockAvailable: 4, purchasable: true }
];

function buildApi(result: TransactionResultDto): ApiClient {
  return { fetchCatalog: jest.fn(async () => catalog), submitPayment: jest.fn(async () => result), getTransactionStatus: jest.fn(async () => result) };
}

function renderApp(api: ApiClient, storage: SecureStorageBoundary = new MemorySecureStorage()) {
  const store = createCheckoutStore();
  render(
    <Provider store={store}>
      <RootNavigator api={api} storage={storage} today={new Date("2026-01-01")} />
    </Provider>
  );
  return store;
}

describe("RootNavigator end-to-end checkout flow", () => {
  it("hydrates past Splash into Home, and completes a full successful purchase with a chosen installment count", async () => {
    const api = buildApi(succeeded("txn-1"));
    const store = renderApp(api);

    await waitFor(() => expect(screen.getByText("Wireless Headphones")).toBeTruthy());

    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    fireEvent.press(screen.getByTestId("cart-summary"));
    fireEvent.press(screen.getByRole("button", { name: "Continue to Checkout" }));
    fireEvent.changeText(screen.getByLabelText("Full name"), "Ada Lovelace");
    fireEvent.changeText(screen.getByLabelText("Email"), "ada@example.com");
    fireEvent.press(screen.getByRole("button", { name: "Pay with credit card" }));

    fireEvent.changeText(screen.getByLabelText("Cardholder name"), "Ada Lovelace");
    fireEvent.changeText(screen.getByLabelText("Card number"), "4111111111111111");
    fireEvent.changeText(screen.getByLabelText("Expiration month"), "12");
    fireEvent.changeText(screen.getByLabelText("Expiration year"), "2099");
    fireEvent.changeText(screen.getByLabelText("CVC"), "123");
    fireEvent.press(screen.getByRole("button", { name: "6 installments" }));
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));

    fireEvent.press(screen.getByRole("button", { name: "Pay" }));

    await waitFor(() => expect(screen.getByText("Payment approved")).toBeTruthy());
    expect(api.submitPayment).toHaveBeenCalledWith(expect.objectContaining({ installments: 6 }));
    expect(store.getState().checkout.fakeCard.number).toBe("");

    // The success screen must still show what was actually charged/purchased
    // even though the cart is cleared as soon as the payment is approved.
    expect(screen.getByText("Wireless Headphones x1")).toBeTruthy();
    expect(screen.getByText("$120,000")).toBeTruthy();
    expect(store.getState().checkout.cart).toEqual({});

    fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    await waitFor(() => expect(screen.getByText("Wireless Headphones")).toBeTruthy());
    expect(store.getState().checkout.cart).toEqual({});
  });

  it("shows the failure frame and preserves the cart on a declined payment, without ever surfacing PAN/CVC", async () => {
    const api = buildApi(failed("txn-2", "payment_declined", true));
    const store = renderApp(api);

    await waitFor(() => expect(screen.getByText("Wireless Headphones")).toBeTruthy());
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    fireEvent.press(screen.getByTestId("cart-summary"));
    fireEvent.press(screen.getByRole("button", { name: "Continue to Checkout" }));
    fireEvent.changeText(screen.getByLabelText("Full name"), "Ada Lovelace");
    fireEvent.changeText(screen.getByLabelText("Email"), "ada@example.com");
    fireEvent.press(screen.getByRole("button", { name: "Pay with credit card" }));
    fireEvent.changeText(screen.getByLabelText("Cardholder name"), "Ada Lovelace");
    fireEvent.changeText(screen.getByLabelText("Card number"), "4111111111111111");
    fireEvent.changeText(screen.getByLabelText("Expiration month"), "12");
    fireEvent.changeText(screen.getByLabelText("Expiration year"), "2099");
    fireEvent.changeText(screen.getByLabelText("CVC"), "123");
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    fireEvent.press(screen.getByRole("button", { name: "Pay" }));

    await waitFor(() => expect(screen.getByText("Payment declined")).toBeTruthy());
    expect(store.getState().checkout.cart).toEqual({ "sku-1": 1 });
    expect(JSON.stringify(store.getState().checkout)).not.toContain("4111111111111111");

    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pay with credit card" })).toBeTruthy());
  });

  it("never offers a resubmit action for a still-PENDING transaction, to avoid a duplicate charge", async () => {
    const pending: TransactionResultDto = {
      status: "PENDING",
      transactionId: "txn-3",
      message: "The payment is still pending confirmation.",
      transaction: { transactionId: "txn-3", transactionNumber: "TX-3", reference: "REF-3", status: "PENDING", amountInCents: 12000000, currency: "COP", installments: 1 }
    };
    const api = buildApi(pending);
    const store = renderApp(api);

    await waitFor(() => expect(screen.getByText("Wireless Headphones")).toBeTruthy());
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    fireEvent.press(screen.getByTestId("cart-summary"));
    fireEvent.press(screen.getByRole("button", { name: "Continue to Checkout" }));
    fireEvent.changeText(screen.getByLabelText("Full name"), "Ada Lovelace");
    fireEvent.changeText(screen.getByLabelText("Email"), "ada@example.com");
    fireEvent.press(screen.getByRole("button", { name: "Pay with credit card" }));
    fireEvent.changeText(screen.getByLabelText("Cardholder name"), "Ada Lovelace");
    fireEvent.changeText(screen.getByLabelText("Card number"), "4111111111111111");
    fireEvent.changeText(screen.getByLabelText("Expiration month"), "12");
    fireEvent.changeText(screen.getByLabelText("Expiration year"), "2099");
    fireEvent.changeText(screen.getByLabelText("CVC"), "123");
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    fireEvent.press(screen.getByRole("button", { name: "Pay" }));

    await waitFor(() => expect(screen.getByText("Payment pending")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    await waitFor(() => expect(screen.getByText("Wireless Headphones")).toBeTruthy());
  });

  it("polls the reconciliation endpoint while a transaction remains PENDING, and updates the screen once it resolves", async () => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    const pending: TransactionResultDto = {
      status: "PENDING",
      transactionId: "txn-6",
      message: "The payment is still pending confirmation.",
      transaction: { transactionId: "txn-6", transactionNumber: "TX-6", reference: "REF-6", status: "PENDING", amountInCents: 12000000, currency: "COP", installments: 1, providerTransactionId: "provider_txn_6" }
    };
    const resolved: TransactionResultDto = succeeded("txn-6");
    const getTransactionStatus = jest.fn<Promise<TransactionResultDto>, [string]>().mockResolvedValueOnce(pending).mockResolvedValueOnce(resolved);
    const api: ApiClient = { fetchCatalog: jest.fn(async () => catalog), submitPayment: jest.fn(async () => pending), getTransactionStatus };
    const store = renderApp(api);

    try {
      await waitFor(() => expect(screen.getByText("Wireless Headphones")).toBeTruthy());
      fireEvent.press(screen.getByRole("button", { name: "Add" }));
      fireEvent.press(screen.getByTestId("cart-summary"));
      fireEvent.press(screen.getByRole("button", { name: "Continue to Checkout" }));
      fireEvent.changeText(screen.getByLabelText("Full name"), "Ada Lovelace");
      fireEvent.changeText(screen.getByLabelText("Email"), "ada@example.com");
      fireEvent.press(screen.getByRole("button", { name: "Pay with credit card" }));
      fireEvent.changeText(screen.getByLabelText("Cardholder name"), "Ada Lovelace");
      fireEvent.changeText(screen.getByLabelText("Card number"), "4111111111111111");
      fireEvent.changeText(screen.getByLabelText("Expiration month"), "12");
      fireEvent.changeText(screen.getByLabelText("Expiration year"), "2099");
      fireEvent.changeText(screen.getByLabelText("CVC"), "123");
      fireEvent.press(screen.getByRole("button", { name: "Continue" }));
      fireEvent.press(screen.getByRole("button", { name: "Pay" }));

      await waitFor(() => expect(screen.getByText("Payment pending")).toBeTruthy());
      expect(getTransactionStatus).not.toHaveBeenCalled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(4000);
      });
      expect(getTransactionStatus).toHaveBeenCalledTimes(1);
      expect(getTransactionStatus).toHaveBeenCalledWith("txn-6");
      // First poll resolved to PENDING again: still on the pending screen, no store update yet.
      expect(screen.getByText("Payment pending")).toBeTruthy();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(4000);
      });
      expect(getTransactionStatus).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(screen.getByText("Payment approved")).toBeTruthy());
      expect(store.getState().checkout.lastResult).toEqual(resolved);

      // Polling must have stopped: advancing time further triggers no more calls.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20000);
      });
      expect(getTransactionStatus).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
