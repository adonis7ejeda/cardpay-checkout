import type { CatalogItemDto, CartItemDto, PaymentAttemptDto, TransactionResultDto } from "@cardpay/contracts";
import type { CatalogPort, PaymentProviderPort, StockPort, TransactionRecord, TransactionRepositoryPort } from "./ports";

const products: CatalogItemDto[] = [
  { id: "basic-tee", name: "Basic Tee", description: "Everyday cotton tee", unitPrice: { amount: 45000, currency: "COP" }, stockAvailable: 4, purchasable: true },
  { id: "canvas-tote", name: "Canvas Tote", description: "Reusable checkout tote", unitPrice: { amount: 32000, currency: "COP" }, stockAvailable: 2, purchasable: true },
];

export class InMemoryCatalogAdapter implements CatalogPort, StockPort {
  private readonly stock = new Map(products.map((item) => [item.id, item.stockAvailable]));

  async list(): Promise<CatalogItemDto[]> {
    return products.map((item) => {
      const stockAvailable = this.stock.get(item.id) ?? 0;
      return { ...item, stockAvailable, purchasable: stockAvailable > 0 };
    });
  }

  async hasStock(items: CartItemDto[]): Promise<boolean> {
    return items.every((item) => {
      const stockAvailable = this.stock.get(item.productId);
      return stockAvailable !== undefined && item.quantity <= stockAvailable;
    });
  }

  setStock(productId: string, quantity: number): void {
    this.stock.set(productId, quantity);
  }
}

export class DeterministicFakePaymentAdapter implements PaymentProviderPort {
  async authorize(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    const transactionId = `fake_${hash(`${attempt.identity.email}:${attempt.totals.total.amount}:${last4(attempt.fakeCard.number)}`)}`;
    if (last4(attempt.fakeCard.number) === "0000") {
      return { status: "failed", transactionId, reasonCode: "payment_declined", retryable: true, message: "The card payment was declined." };
    }

    return { status: "succeeded", transactionId, message: "The payment was approved." };
  }
}

export class InMemoryTransactionRepository implements TransactionRepositoryPort {
  private readonly records: TransactionRecord[] = [];

  async save(record: TransactionRecord): Promise<TransactionRecord> {
    this.records.push(record);
    return record;
  }

  async all(): Promise<TransactionRecord[]> {
    return [...this.records];
  }
}

function last4(value: string): string {
  return value.replace(/\D/g, "").slice(-4);
}

function hash(value: string): string {
  let current = 0;
  for (const char of value) current = (current * 31 + char.charCodeAt(0)) >>> 0;
  return current.toString(16).padStart(8, "0");
}
