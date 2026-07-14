import type { CatalogItemDto, CartItemDto, PaymentAttemptDto, ProviderTransactionResultDto, TransactionResultDto } from "@cardpay/contracts";

export interface CatalogPort {
  list(): Promise<CatalogItemDto[]>;
}

export interface StockPort {
  reserveStock(items: CartItemDto[]): Promise<boolean>;
  releaseStock(items: CartItemDto[]): Promise<void>;
}

export interface PaymentProviderPort {
  tokenizeCard(card: PaymentAttemptDto["card"]): Promise<{ cardToken: string }>;
  fetchAcceptanceToken(): Promise<{ acceptanceToken: string; personalDataAuthToken: string }>;
  createTransaction(request: {
    reference: string;
    amountInCents: number;
    currency: "COP";
    installments: number;
    cardToken: string;
    acceptanceToken: string;
    personalDataAuthToken: string;
    customerEmail: string;
  }): Promise<{ providerTransactionId: string }>;
  pollTransaction(providerTransactionId: string): Promise<ProviderTransactionResultDto>;
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
