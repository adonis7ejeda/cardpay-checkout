import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PrimaryButton } from "./PrimaryButton";

describe("PrimaryButton", () => {
  it("renders its label and calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Continue to Checkout" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Continue to Checkout" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Pay" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole("button", { name: "Pay" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
