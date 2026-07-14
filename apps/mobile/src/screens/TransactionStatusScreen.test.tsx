import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { failed, succeeded } from "@cardpay/core";
import type { CartItemDto } from "@cardpay/contracts";
import { TransactionStatusScreen } from "./TransactionStatusScreen";

const items: CartItemDto[] = [{ productId: "sku-1", quantity: 2, unitPrice: { amount: 120000, currency: "COP" } }];
const productNames = { "sku-1": "Wireless Headphones" };

describe("TransactionStatusScreen", () => {
  it("fully renders the success frame with a success icon, transaction number, total, and Back to Home action", () => {
    const onPrimaryAction = jest.fn();
    render(
      <TransactionStatusScreen
        result={succeeded("txn-1")}
        totalLabel="$240,000"
        timestamp="2026-01-01T00:00:00.000Z"
        items={items}
        productNames={productNames}
        onPrimaryAction={onPrimaryAction}
      />
    );
    expect(screen.getByText("✓")).toBeTruthy();
    expect(screen.getByText("Payment approved")).toBeTruthy();
    expect(screen.getByText("txn-1")).toBeTruthy();
    expect(screen.getByText("$240,000")).toBeTruthy();
    expect(screen.getByText("Wireless Headphones x2")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Back to Home" });
    fireEvent.press(button);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it("fully renders a distinct failure frame with a warning icon, decline reason, transaction number, and Try again action", () => {
    const onPrimaryAction = jest.fn();
    render(
      <TransactionStatusScreen
        result={failed("txn-2", "payment_declined", true)}
        totalLabel="$240,000"
        timestamp="2026-01-01T00:00:00.000Z"
        items={items}
        productNames={productNames}
        onPrimaryAction={onPrimaryAction}
      />
    );
    expect(screen.getByText("!")).toBeTruthy();
    expect(screen.getByText("Payment declined")).toBeTruthy();
    expect(screen.getByText("txn-2")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Try again" });
    fireEvent.press(button);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });
});
