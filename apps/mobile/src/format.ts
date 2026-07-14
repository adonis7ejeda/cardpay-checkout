import type { MoneyDto } from "@cardpay/contracts";

/**
 * Formats a MoneyDto as a whole-unit currency string. COP amounts in this
 * catalog have no minor unit, so this intentionally avoids Intl currency
 * formatting (which varies by ICU data availability) in favor of a
 * deterministic "$" + thousands-separated integer.
 */
export function formatMoney(money: MoneyDto): string {
  return `$${money.amount.toLocaleString("en-US")}`;
}
