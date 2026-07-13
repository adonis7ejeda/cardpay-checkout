import type { CatalogItemDto, CartItemDto, PaymentAttemptDto, TransactionResultDto } from "@cardpay/contracts";

export interface CatalogPort {
  list(): Promise<CatalogItemDto[]>;
}

export interface StockPort {
  hasStock(items: CartItemDto[]): Promise<boolean>;
}

export interface PaymentProviderPort {
  authorize(attempt: PaymentAttemptDto): Promise<TransactionResultDto>;
}

export interface TransactionRecord {
  result: TransactionResultDto;
  cartItems: CartItemDto[];
  createdAt: string;
}

export interface TransactionRepositoryPort {
  save(record: TransactionRecord): Promise<TransactionRecord>;
  all(): Promise<TransactionRecord[]>;
}
