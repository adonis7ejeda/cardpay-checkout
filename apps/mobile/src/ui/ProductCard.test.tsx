import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { CatalogItemDto } from "@cardpay/contracts";
import { ProductCard } from "./ProductCard";

const product: CatalogItemDto = {
  id: "sku-1",
  name: "Wireless Headphones",
  description: "Noise-isolating audio",
  unitPrice: { amount: 120000, currency: "COP" },
  stockAvailable: 4,
  purchasable: true
};

describe("ProductCard", () => {
  it("shows an Add action and the stock badge when the product is not yet in the cart", () => {
    render(<ProductCard product={product} quantity={0} onAdd={jest.fn()} onChangeQuantity={jest.fn()} />);
    expect(screen.getByText("Wireless Headphones")).toBeTruthy();
    expect(screen.getByText("$120,000")).toBeTruthy();
    expect(screen.getByText("4 available")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("shows the quantity stepper instead of Add once the product has quantity > 0 in the cart", () => {
    render(<ProductCard product={product} quantity={2} onAdd={jest.fn()} onChangeQuantity={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("calls onAdd when Add is pressed", () => {
    const onAdd = jest.fn();
    render(<ProductCard product={product} quantity={0} onAdd={onAdd} onChangeQuantity={jest.fn()} />);
    fireEvent.press(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("sku-1");
  });

  it("calls onChangeQuantity with the incremented value when the stepper + is pressed", () => {
    const onChangeQuantity = jest.fn();
    render(<ProductCard product={product} quantity={1} onAdd={jest.fn()} onChangeQuantity={onChangeQuantity} />);
    fireEvent.press(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onChangeQuantity).toHaveBeenCalledWith("sku-1", 2);
  });

  it("always renders a stock badge, showing Out of stock and disabling Add when stock is depleted", () => {
    render(<ProductCard product={{ ...product, stockAvailable: 0 }} quantity={0} onAdd={jest.fn()} onChangeQuantity={jest.fn()} />);
    expect(screen.getByText("Out of stock")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});
