import type { CatalogItemDto, CheckoutIdentityDto, PaymentAttemptDto, TransactionResultDto } from "@cardpay/contracts";

export type ScreenName =
  | "Splash"
  | "Products"
  | "Cart"
  | "Checkout"
  | "CardInfo"
  | "PaymentSummary"
  | "TransactionSuccess"
  | "TransactionFailure";

export interface ApiClient {
  fetchCatalog(): Promise<CatalogItemDto[]>;
  submitPayment(input: PaymentAttemptDto): Promise<TransactionResultDto>;
  getTransactionStatus(transactionId: string): Promise<TransactionResultDto>;
}

export interface SecureStorageBoundary {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PersistedCheckoutSnapshot {
  catalog: CatalogItemDto[];
  cart: Record<string, number>;
  identity: CheckoutIdentityDto;
  updatedAt: string;
}
