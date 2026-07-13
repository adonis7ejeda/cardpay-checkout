import { calculateCartTotals, maskCvc, validateFakeCard, validateIdentity } from "@cardpay/core";
import type { CartItemDto, CatalogItemDto, CheckoutIdentityDto, FakeCardInputDto, TransactionResultDto } from "@cardpay/contracts";

export const PrimaryButton = (label: string, disabled = false) => ({ role: "button", label, disabled });
export const SummaryRow = (label: string, value: string) => ({ label, value });
export const StockBadge = (stockAvailable: number) => ({ label: stockAvailable > 0 ? `${stockAvailable} available` : "Out of stock", available: stockAvailable > 0 });
export const QuantityStepper = (quantity: number, max: number) => ({ quantity, canDecrease: quantity > 0, canIncrease: quantity < max });
export const ProductCard = (product: CatalogItemDto, quantity = 0) => ({ title: product.name, description: product.description, price: product.unitPrice, stock: StockBadge(product.stockAvailable), quantity: QuantityStepper(quantity, product.stockAvailable) });
export const SummaryRowCurrency = (label: string, amount: number) => SummaryRow(label, new Intl.NumberFormat("en-US", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount));

export function CartSummary(items: CartItemDto[]) {
  const totals = calculateCartTotals(items);
  return { rows: [SummaryRowCurrency("Subtotal", totals.subtotal.amount), SummaryRowCurrency("Total", totals.total.amount)], itemCount: totals.itemCount };
}

export function BackdropShell(title: string, open: boolean) {
  return { title, open, cancelLabel: "Cancel" };
}

export function CardForm(input: FakeCardInputDto, today?: Date) {
  const validation = validateFakeCard(input, today);
  return { brand: validation.brand, errors: validation.errors, cvcPreview: maskCvc(input.cvc), continueButton: PrimaryButton("Continue", !validation.valid) };
}

export function PaymentSummary(identity: CheckoutIdentityDto, items: CartItemDto[]) {
  const identityValidation = validateIdentity(identity);
  return { identityErrors: identityValidation.errors, cart: CartSummary(items), payButton: PrimaryButton("Pay now", !identityValidation.valid || items.length === 0) };
}

export function TransactionStatus(result: TransactionResultDto) {
  return { title: result.status === "succeeded" ? "Payment approved" : "Payment could not be completed", message: result.message, retryable: result.status === "failed" ? result.retryable : false };
}
