export const MIN_QUANTITY = 1;

export function normalizeQuantity(value: number, stockAvailable: number): number {
  if (!Number.isInteger(value)) return MIN_QUANTITY;
  return Math.min(Math.max(value, MIN_QUANTITY), Math.max(stockAvailable, 0));
}

export function canPurchaseQuantity(quantity: number, stockAvailable: number): boolean {
  return Number.isInteger(quantity) && quantity >= MIN_QUANTITY && quantity <= stockAvailable;
}
