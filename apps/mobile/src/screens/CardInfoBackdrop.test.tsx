import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { FakeCardInputDto } from "@cardpay/contracts";
import { CardInfoBackdrop } from "./CardInfoBackdrop";

const emptyCard: FakeCardInputDto = { cardholderName: "", number: "", expirationMonth: "", expirationYear: "", cvc: "" };
const validCard: FakeCardInputDto = { cardholderName: "Ada Lovelace", number: "4111111111111111", expirationMonth: "12", expirationYear: "2099", cvc: "123" };
const today = new Date("2026-01-01");

describe("CardInfoBackdrop", () => {
  it("masks the CVC input like a password field", () => {
    render(<CardInfoBackdrop open value={emptyCard} installments={1} onChangeField={jest.fn()} onChangeInstallments={jest.fn()} onCancel={jest.fn()} onSubmit={jest.fn()} today={today} />);
    expect(screen.getByLabelText("CVC").props.secureTextEntry).toBe(true);
  });

  it("disables Continue and shows inline errors while the card is invalid", () => {
    render(<CardInfoBackdrop open value={emptyCard} installments={1} onChangeField={jest.fn()} onChangeInstallments={jest.fn()} onCancel={jest.fn()} onSubmit={jest.fn()} today={today} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByText("Valid fake Visa or Mastercard number is required")).toBeTruthy();
  });

  it("enables Continue once every field is valid and calls onSubmit when pressed", () => {
    const onSubmit = jest.fn();
    render(<CardInfoBackdrop open value={validCard} installments={1} onChangeField={jest.fn()} onChangeInstallments={jest.fn()} onCancel={jest.fn()} onSubmit={onSubmit} today={today} />);
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toBeEnabled();
    fireEvent.press(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("lets the shopper pick an installment count", () => {
    const onChangeInstallments = jest.fn();
    render(<CardInfoBackdrop open value={validCard} installments={1} onChangeField={jest.fn()} onChangeInstallments={onChangeInstallments} onCancel={jest.fn()} onSubmit={jest.fn()} today={today} />);
    fireEvent.press(screen.getByRole("button", { name: "12 installments" }));
    expect(onChangeInstallments).toHaveBeenCalledWith(12);
  });

  it("calls onCancel from the backdrop's close affordance", () => {
    const onCancel = jest.fn();
    render(<CardInfoBackdrop open value={emptyCard} installments={1} onChangeField={jest.fn()} onChangeInstallments={jest.fn()} onCancel={onCancel} onSubmit={jest.fn()} today={today} />);
    fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("strips digits out of the cardholder name as the shopper types", () => {
    const onChangeField = jest.fn();
    render(<CardInfoBackdrop open value={emptyCard} installments={1} onChangeField={onChangeField} onChangeInstallments={jest.fn()} onCancel={jest.fn()} onSubmit={jest.fn()} today={today} />);
    fireEvent.changeText(screen.getByLabelText("Cardholder name"), "Ada4 Lovelace2");
    expect(onChangeField).toHaveBeenCalledWith("cardholderName", "Ada Lovelace");
  });

  it("strips letters out of the card number as the shopper types", () => {
    const onChangeField = jest.fn();
    render(<CardInfoBackdrop open value={emptyCard} installments={1} onChangeField={onChangeField} onChangeInstallments={jest.fn()} onCancel={jest.fn()} onSubmit={jest.fn()} today={today} />);
    fireEvent.changeText(screen.getByLabelText("Card number"), "4a111111111111111b");
    expect(onChangeField).toHaveBeenCalledWith("number", "4111111111111111");
  });

  it("strips letters out of the expiration month, expiration year, and CVC fields", () => {
    const onChangeField = jest.fn();
    render(<CardInfoBackdrop open value={emptyCard} installments={1} onChangeField={onChangeField} onChangeInstallments={jest.fn()} onCancel={jest.fn()} onSubmit={jest.fn()} today={today} />);
    fireEvent.changeText(screen.getByLabelText("Expiration month"), "1a2");
    expect(onChangeField).toHaveBeenCalledWith("expirationMonth", "12");
    fireEvent.changeText(screen.getByLabelText("Expiration year"), "2b9");
    expect(onChangeField).toHaveBeenCalledWith("expirationYear", "29");
    fireEvent.changeText(screen.getByLabelText("CVC"), "1x2y3");
    expect(onChangeField).toHaveBeenCalledWith("cvc", "123");
  });
});
