import type { CatalogItemDto, CartItemDto, CheckoutIdentityDto, LocalTransactionStatus, PaymentAttemptDto, ProviderTransactionResultDto, TransactionResultDto } from "@cardpay/contracts";

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
  identity: CheckoutIdentityDto;
}

export interface TransactionRepositoryPort {
  save(record: TransactionRecord): Promise<TransactionRecord>;
  all(): Promise<TransactionRecord[]>;
  findById(transactionId: string): Promise<TransactionRecord | undefined>;
  /**
   * Persists `record` only if the CURRENTLY STORED record for that
   * transactionId still has status `expectedCurrentStatus`. Returns `true`
   * if the write happened, `false` if the stored status had already moved
   * on (a lost race, not an error) -- the guard preventing double
   * stock-release or double delivery-assignment when two reconciliation
   * calls race for the same still-PENDING transaction.
   */
  saveIfStatus(record: TransactionRecord, expectedCurrentStatus: LocalTransactionStatus): Promise<boolean>;
}
