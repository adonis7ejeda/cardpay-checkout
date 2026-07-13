import { onlyDigits } from "./card";

export function maskCardNumber(number: string): string {
  const digits = onlyDigits(number);
  const lastFour = digits.slice(-4);
  return lastFour ? `•••• •••• •••• ${lastFour}` : "";
}

export function maskCvc(cvc: string): string {
  return "•".repeat(onlyDigits(cvc).length);
}
