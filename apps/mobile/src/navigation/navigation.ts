import type { ScreenName } from "../ports";

export const checkoutScreens: ScreenName[] = [
  "Splash",
  "Products",
  "Cart",
  "Checkout",
  "CardInfo",
  "PaymentSummary",
  "TransactionSuccess",
  "TransactionFailure"
];

export function nextScreen(current: ScreenName, outcome?: "succeeded" | "failed"): ScreenName {
  if (current === "PaymentSummary") return outcome === "failed" ? "TransactionFailure" : "TransactionSuccess";
  const index = checkoutScreens.indexOf(current);
  return checkoutScreens[Math.min(index + 1, checkoutScreens.length - 1)];
}

export function cancelBackdrop(current: ScreenName): ScreenName {
  return current === "CardInfo" || current === "PaymentSummary" ? "Checkout" : current;
}

export function previousScreen(current: ScreenName): ScreenName {
  if (current === "Cart") return "Products";
  if (current === "Checkout") return "Cart";
  return current;
}
