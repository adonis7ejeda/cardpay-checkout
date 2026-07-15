import type { CartItemDto, CartTotalsDto, MoneyDto } from "@cardpay/contracts";

export function money(amount: number, currency: MoneyDto["currency"] = "COP"): MoneyDto {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Money amount must be a non-negative integer");
  return { amount, currency };
}

export function calculateCartTotals(items: CartItemDto[], currency: MoneyDto["currency"] = "COP"): CartTotalsDto {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice.amount * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { subtotal: money(subtotal, currency), total: money(subtotal, currency), itemCount };
}
