import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { CartItemDto } from "@cardpay/contracts";
import { SelectProductScreen } from "./SelectProductScreen";

const items: CartItemDto[] = [{ productId: "sku-1", quantity: 2, unitPrice: { amount: 120000, currency: "COP" } }];

describe("SelectProductScreen", () => {
  it("lists selected items with a line subtotal and an order total", () => {
    render(<SelectProductScreen items={items} productNames={{ "sku-1": "Wireless Headphones" }} stockByProduct={{ "sku-1": 4 }} onChangeQuantity={jest.fn()} onRemove={jest.fn()} onContinue={jest.fn()} onBack={jest.fn()} />);
    expect(screen.getByText("Wireless Headphones")).toBeTruthy();
    expect(screen.getByText("$240,000")).toBeTruthy();
  });

  it("disables Continue to Checkout when the cart is empty and blocks navigation", () => {
    const onContinue = jest.fn();
    render(<SelectProductScreen items={[]} productNames={{}} stockByProduct={{}} onChangeQuantity={jest.fn()} onRemove={jest.fn()} onContinue={onContinue} onBack={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Continue to Checkout" });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("offers a way back to Home from the header and from the empty-cart state", () => {
    const onBack = jest.fn();
    render(<SelectProductScreen items={[]} productNames={{}} stockByProduct={{}} onChangeQuantity={jest.fn()} onRemove={jest.fn()} onContinue={jest.fn()} onBack={onBack} />);
    fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("removes an item instead of allowing its quantity to reach zero", () => {
    const onRemove = jest.fn();
    render(<SelectProductScreen items={items} productNames={{ "sku-1": "Wireless Headphones" }} stockByProduct={{ "sku-1": 4 }} onChangeQuantity={jest.fn()} onRemove={onRemove} onContinue={jest.fn()} onBack={jest.fn()} />);
    fireEvent.press(screen.getByRole("button", { name: "Remove Wireless Headphones" }));
    expect(onRemove).toHaveBeenCalledWith("sku-1");
  });

  it("never allows a stepper increase past available stock", () => {
    const onChangeQuantity = jest.fn();
    render(<SelectProductScreen items={items} productNames={{ "sku-1": "Wireless Headphones" }} stockByProduct={{ "sku-1": 2 }} onChangeQuantity={onChangeQuantity} onRemove={jest.fn()} onContinue={jest.fn()} onBack={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  it("increases the quantity when stock allows it", () => {
    const onChangeQuantity = jest.fn();
    render(<SelectProductScreen items={items} productNames={{ "sku-1": "Wireless Headphones" }} stockByProduct={{ "sku-1": 4 }} onChangeQuantity={onChangeQuantity} onRemove={jest.fn()} onContinue={jest.fn()} onBack={jest.fn()} />);
    fireEvent.press(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onChangeQuantity).toHaveBeenCalledWith("sku-1", 3);
  });

  it("decreases the quantity when above the minimum", () => {
    const onChangeQuantity = jest.fn();
    render(<SelectProductScreen items={items} productNames={{ "sku-1": "Wireless Headphones" }} stockByProduct={{ "sku-1": 4 }} onChangeQuantity={onChangeQuantity} onRemove={jest.fn()} onContinue={jest.fn()} onBack={jest.fn()} />);
    fireEvent.press(screen.getByRole("button", { name: "Decrease quantity for sku-1" }));
    expect(onChangeQuantity).toHaveBeenCalledWith("sku-1", 1);
  });

  it("disables the decrease stepper at quantity 1", () => {
    const singleItem: CartItemDto[] = [{ productId: "sku-1", quantity: 1, unitPrice: { amount: 120000, currency: "COP" } }];
    render(<SelectProductScreen items={singleItem} productNames={{ "sku-1": "Wireless Headphones" }} stockByProduct={{ "sku-1": 4 }} onChangeQuantity={jest.fn()} onRemove={jest.fn()} onContinue={jest.fn()} onBack={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Decrease quantity for sku-1" })).toBeDisabled();
  });
});
