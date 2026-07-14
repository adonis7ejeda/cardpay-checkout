import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { CartItemDto, CheckoutIdentityDto } from "@cardpay/contracts";
import { CheckoutScreen } from "./CheckoutScreen";

const items: CartItemDto[] = [{ productId: "sku-1", quantity: 2, unitPrice: { amount: 120000, currency: "COP" } }];
const validIdentity: CheckoutIdentityDto = { fullName: "Ada Lovelace", email: "ada@example.com" };
const emptyIdentity: CheckoutIdentityDto = { fullName: "", email: "" };

describe("CheckoutScreen", () => {
  it("shows the order summary total and a Pay with credit card action once identity is valid", () => {
    render(<CheckoutScreen items={items} identity={validIdentity} onChangeIdentity={jest.fn()} onPayWithCard={jest.fn()} />);
    expect(screen.getByTestId("checkout-total")).toHaveTextContent("$240,000");
    expect(screen.getByRole("button", { name: "Pay with credit card" })).toBeEnabled();
  });

  it("disables Pay with credit card until customer name and email are valid", () => {
    render(<CheckoutScreen items={items} identity={emptyIdentity} onChangeIdentity={jest.fn()} onPayWithCard={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Pay with credit card" })).toBeDisabled();
  });

  it("opens the card info backdrop when Pay with credit card is pressed", () => {
    const onPayWithCard = jest.fn();
    render(<CheckoutScreen items={items} identity={validIdentity} onChangeIdentity={jest.fn()} onPayWithCard={onPayWithCard} />);
    fireEvent.press(screen.getByRole("button", { name: "Pay with credit card" }));
    expect(onPayWithCard).toHaveBeenCalledTimes(1);
  });

  it("updates identity fields as the customer types", () => {
    const onChangeIdentity = jest.fn();
    render(<CheckoutScreen items={items} identity={emptyIdentity} onChangeIdentity={onChangeIdentity} onPayWithCard={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText("Full name"), "Ada Lovelace");
    expect(onChangeIdentity).toHaveBeenCalledWith("fullName", "Ada Lovelace");
  });

  it("blocks payment and shows an empty-order message when the cart was emptied via back navigation", () => {
    render(<CheckoutScreen items={[]} identity={validIdentity} onChangeIdentity={jest.fn()} onPayWithCard={jest.fn()} />);
    expect(screen.getByText("Your order is empty. Go back to Home to add products.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pay with credit card" })).toBeNull();
  });
});
