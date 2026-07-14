import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { CartItemDto, FakeCardInputDto } from "@cardpay/contracts";
import { PaymentSummaryBackdrop } from "./PaymentSummaryBackdrop";

const card: FakeCardInputDto = { cardholderName: "Ada Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2099", cvc: "123" };
const items: CartItemDto[] = [{ productId: "sku-1", quantity: 2, unitPrice: { amount: 120000, currency: "COP" } }];
const productNames = { "sku-1": "Wireless Headphones" };

describe("PaymentSummaryBackdrop", () => {
  it("shows the masked card number, brand, cardholder name, and order total", () => {
    render(<PaymentSummaryBackdrop open card={card} items={items} productNames={productNames} isSubmitting={false} onCancel={jest.fn()} onPay={jest.fn()} />);
    expect(screen.getByText("•••• •••• •••• 1111")).toBeTruthy();
    expect(screen.getByText("visa")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByTestId("summary-total")).toHaveTextContent("$240,000");
  });

  it("shows the product name instead of the internal product id in the itemized list", () => {
    render(<PaymentSummaryBackdrop open card={card} items={items} productNames={productNames} isSubmitting={false} onCancel={jest.fn()} onPay={jest.fn()} />);
    expect(screen.getByText("Wireless Headphones")).toBeTruthy();
    expect(screen.queryByText("sku-1")).toBeNull();
  });

  it("falls back to the product id when no product name is known", () => {
    render(<PaymentSummaryBackdrop open card={card} items={items} productNames={{}} isSubmitting={false} onCancel={jest.fn()} onPay={jest.fn()} />);
    expect(screen.getByText("sku-1")).toBeTruthy();
  });

  it("shows a loading Pay button and blocks double submission while a payment is in flight", () => {
    const onPay = jest.fn();
    render(<PaymentSummaryBackdrop open card={card} items={items} productNames={productNames} isSubmitting onCancel={jest.fn()} onPay={onPay} />);
    const button = screen.getByRole("button", { name: "Pay" });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPay).not.toHaveBeenCalled();
  });

  it("calls onPay once when pressed while idle", () => {
    const onPay = jest.fn();
    render(<PaymentSummaryBackdrop open card={card} items={items} productNames={productNames} isSubmitting={false} onCancel={jest.fn()} onPay={onPay} />);
    fireEvent.press(screen.getByRole("button", { name: "Pay" }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error toast without losing the entered card or losing the total", () => {
    render(<PaymentSummaryBackdrop open card={card} items={items} productNames={productNames} isSubmitting={false} errorMessage="Payment was declined" onCancel={jest.fn()} onPay={jest.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Payment was declined");
    expect(screen.getByText("•••• •••• •••• 1111")).toBeTruthy();
    expect(screen.getByTestId("summary-total")).toHaveTextContent("$240,000");
  });
});
