import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { CatalogItemDto } from "@cardpay/contracts";
import { HomeProductsScreen } from "./HomeProductsScreen";

const catalog: CatalogItemDto[] = [
  { id: "sku-1", name: "Wireless Headphones", description: "Noise-isolating audio", unitPrice: { amount: 120000, currency: "COP" }, stockAvailable: 4, purchasable: true },
  { id: "sku-2", name: "Mechanical Keyboard", description: "Hot-swappable switches", unitPrice: { amount: 350000, currency: "COP" }, stockAvailable: 0, purchasable: true }
];

describe("HomeProductsScreen", () => {
  it("renders every catalog product with its own stock badge", () => {
    render(<HomeProductsScreen catalog={catalog} cart={{}} width={750} onAdd={jest.fn()} onChangeQuantity={jest.fn()} onGoToCart={jest.fn()} />);
    expect(screen.getByText("Wireless Headphones")).toBeTruthy();
    expect(screen.getByText("Mechanical Keyboard")).toBeTruthy();
    expect(screen.getByText("4 available")).toBeTruthy();
    expect(screen.getByText("Out of stock")).toBeTruthy();
  });

  it("hides the cart summary affordance when the cart is empty", () => {
    render(<HomeProductsScreen catalog={catalog} cart={{}} width={750} onAdd={jest.fn()} onChangeQuantity={jest.fn()} onGoToCart={jest.fn()} />);
    expect(screen.queryByTestId("cart-summary")).toBeNull();
  });

  it("pins a cart summary whose count and subtotal always match the cart contents", () => {
    render(<HomeProductsScreen catalog={catalog} cart={{ "sku-1": 2 }} width={750} onAdd={jest.fn()} onChangeQuantity={jest.fn()} onGoToCart={jest.fn()} />);
    const summary = screen.getByTestId("cart-summary");
    expect(summary).toBeTruthy();
    expect(screen.getByText("2 items · $240,000")).toBeTruthy();
  });

  it("navigates to the cart when the summary is pressed", () => {
    const onGoToCart = jest.fn();
    render(<HomeProductsScreen catalog={catalog} cart={{ "sku-1": 1 }} width={750} onAdd={jest.fn()} onChangeQuantity={jest.fn()} onGoToCart={onGoToCart} />);
    fireEvent.press(screen.getByTestId("cart-summary"));
    expect(onGoToCart).toHaveBeenCalledTimes(1);
  });
});
