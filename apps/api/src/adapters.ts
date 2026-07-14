import type { CatalogItemDto, CartItemDto, DeliveryAssignmentDto, LocalTransactionDto, PaymentAttemptDto, ProviderTransactionResultDto, TransactionResultDto } from "@cardpay/contracts";
import { mapProviderStatus } from "@cardpay/core";
import { createProviderSignature } from "@cardpay/core/server";
import { CATALOG_SEED } from "./catalog-data";
import type { CatalogPort, PaymentProviderPort, StockPort, TransactionRecord, TransactionRepositoryPort } from "./ports";

const products: CatalogItemDto[] = CATALOG_SEED;

export class InMemoryCatalogAdapter implements CatalogPort, StockPort {
  private readonly stock = new Map(products.map((item) => [item.id, item.stockAvailable]));

  async list(): Promise<CatalogItemDto[]> {
    return products.map((item) => {
      const stockAvailable = this.stock.get(item.id) ?? 0;
      return { ...item, stockAvailable, purchasable: stockAvailable > 0 };
    });
  }

  async reserveStock(items: CartItemDto[]): Promise<boolean> {
    const available = items.every((item) => {
      const stockAvailable = this.stock.get(item.productId);
      return stockAvailable !== undefined && item.quantity <= stockAvailable;
    });
    if (!available) return false;
    for (const item of items) this.stock.set(item.productId, (this.stock.get(item.productId) ?? item.quantity) - item.quantity);
    return true;
  }

  async releaseStock(items: CartItemDto[]): Promise<void> {
    for (const item of items) this.stock.set(item.productId, (this.stock.get(item.productId) ?? 0) + item.quantity);
  }

  setStock(productId: string, quantity: number): void {
    this.stock.set(productId, quantity);
  }
}

export class DeterministicFakePaymentAdapter implements PaymentProviderPort {
  private nextStatus: ProviderTransactionResultDto["status"] = "APPROVED";

  async tokenizeCard(card?: PaymentAttemptDto["card"]): Promise<{ cardToken: string }> {
    this.nextStatus = card && last4(card.number) === "0000" ? "DECLINED" : "APPROVED";
    return { cardToken: "fake_card_token" };
  }

  async fetchAcceptanceToken(): Promise<{ acceptanceToken: string; personalDataAuthToken: string }> {
    return { acceptanceToken: "fake_acceptance_token", personalDataAuthToken: "fake_personal_data_auth_token" };
  }

  async createTransaction(request: { reference: string }): Promise<{ providerTransactionId: string }> {
    return { providerTransactionId: `fake_provider_${request.reference}` };
  }

  async pollTransaction(providerTransactionId: string): Promise<ProviderTransactionResultDto> {
    return { providerTransactionId, status: this.nextStatus, safeReason: this.nextStatus === "APPROVED" ? "Approved by fake provider" : "The card payment was declined." };
  }

  async authorize(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    const cardLast4 = last4(attempt.card.number);
    const hashInput = [attempt.identity.email, attempt.totals.total.amount, cardLast4].join(":");
    const transactionId = `fake_${hash(hashInput)}`;
    const transaction = localTransaction(transactionId, attempt, cardLast4 === "0000" ? "FAILED" : "APPROVED");
    if (cardLast4 === "0000") {
      return { status: "failed", transactionId, reasonCode: "payment_declined", retryable: true, message: "The card payment was declined.", transaction };
    }

    const deliveryAssignment = delivery(transaction, attempt);
    return { status: "succeeded", transactionId, message: "The payment was approved.", transaction, deliveryAssignment };
  }
}

export class EnvPaymentProviderAdapter implements PaymentProviderPort {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async tokenizeCard(card: PaymentAttemptDto["card"]): Promise<{ cardToken: string }> {
    const response = await this.post<{ data: { id: string } }>("/tokens/cards", {
      number: card.number,
      cvc: card.cvc,
      exp_month: card.expirationMonth,
      exp_year: card.expirationYear,
      card_holder: card.cardholderName
    });
    return { cardToken: response.data.id };
  }

  async fetchAcceptanceToken(): Promise<{ acceptanceToken: string; personalDataAuthToken: string }> {
    const response = await this.get<{
      data: { presigned_acceptance: { acceptance_token: string }; presigned_personal_data_auth: { acceptance_token: string } };
    }>(`/merchants/${this.required("PAYMENT_PROVIDER_PUBLIC_KEY")}`);
    return {
      acceptanceToken: response.data.presigned_acceptance.acceptance_token,
      personalDataAuthToken: response.data.presigned_personal_data_auth.acceptance_token
    };
  }

  async createTransaction(request: {
    reference: string;
    amountInCents: number;
    currency: "COP";
    installments: number;
    cardToken: string;
    acceptanceToken: string;
    personalDataAuthToken: string;
    customerEmail: string;
  }): Promise<{ providerTransactionId: string }> {
    const signature = createProviderSignature(request.reference, request.amountInCents, request.currency, this.required("PAYMENT_PROVIDER_INTEGRITY_SECRET"));
    const response = await this.post<{ data: { id: string } }>("/transactions", {
      amount_in_cents: request.amountInCents,
      currency: request.currency,
      customer_email: request.customerEmail,
      reference: request.reference,
      acceptance_token: request.acceptanceToken,
      accept_personal_auth: request.personalDataAuthToken,
      signature,
      payment_method: { type: "CARD", token: request.cardToken, installments: request.installments }
    });
    return { providerTransactionId: response.data.id };
  }

  async pollTransaction(providerTransactionId: string): Promise<ProviderTransactionResultDto> {
    const response = await this.get<{ data: { id: string; status: ProviderTransactionResultDto["status"]; status_message?: string } }>(`/transactions/${providerTransactionId}`);
    return { providerTransactionId: response.data.id, status: response.data.status, safeReason: response.data.status_message };
  }

  async authorize(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    const reference = `REF-${Date.now()}`;
    const { cardToken } = await this.tokenizeCard(attempt.card);
    const { acceptanceToken, personalDataAuthToken } = await this.fetchAcceptanceToken();
    const { providerTransactionId } = await this.createTransaction({ reference, amountInCents: attempt.totals.total.amount, currency: "COP", installments: attempt.installments, cardToken, acceptanceToken, personalDataAuthToken, customerEmail: attempt.identity.email });
    const providerResult = await this.pollTransaction(providerTransactionId);
    const status = providerResult.status === "PENDING" ? "RETRYABLE" : mapProviderStatus(providerResult.status);
    const transaction = localTransaction(providerTransactionId, attempt, status);
    if (status === "APPROVED") return { status: "succeeded", transactionId: transaction.transactionId, message: "The payment was approved.", transaction, deliveryAssignment: delivery(transaction, attempt) };
    return { status: "failed", transactionId: transaction.transactionId, reasonCode: status === "RETRYABLE" ? "provider_error" : "payment_declined", retryable: status === "RETRYABLE", message: "The card payment could not be approved.", transaction };
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.required("PAYMENT_PROVIDER_BASE_URL")}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.required("PAYMENT_PROVIDER_PUBLIC_KEY")}` }
    });
    if (!response.ok) {
      const detail = await this.safeValidationDetail(response);
      throw new Error(`Provider request failed (${response.status} ${init.method ?? "GET"} ${path})${detail ? `: ${detail}` : ""}`);
    }
    return (await response.json()) as T;
  }

  /**
   * Extracts only the provider's own field-validation error type/field names
   * (e.g. "acceptance_token: is required") for diagnostics. These are
   * fixed, provider-authored strings describing which of OUR request
   * fields failed validation and why - never an echo of submitted card,
   * email, or personal data - so this is safe to log server-side even
   * though the full response body is not (see the payment-provider fix
   * history: an earlier attempt to log the raw body was rejected by
   * review because it could have echoed unredacted PII/CVC).
   */
  private async safeValidationDetail(response: Response): Promise<string | undefined> {
    try {
      const body = (await response.json()) as { error?: { type?: string; messages?: Record<string, string[]> } };
      if (!body.error) return undefined;
      const fieldSummary = body.error.messages
        ? Object.entries(body.error.messages)
            .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
            .join("; ")
        : undefined;
      return [body.error.type, fieldSummary].filter(Boolean).join(" - ");
    } catch {
      return undefined;
    }
  }

  private required(name: "PAYMENT_PROVIDER_PUBLIC_KEY" | "PAYMENT_PROVIDER_INTEGRITY_SECRET" | "PAYMENT_PROVIDER_BASE_URL"): string {
    const value = this.env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  }
}

export function createDefaultPaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProviderPort {
  const required = ["PAYMENT_PROVIDER_PUBLIC_KEY", "PAYMENT_PROVIDER_INTEGRITY_SECRET", "PAYMENT_PROVIDER_BASE_URL"] as const;
  const configured = required.filter((name) => Boolean(env[name]));
  if (configured.length === 0) {
    if (env.NODE_ENV === "production") throw new Error("Payment provider environment configuration is missing in production.");
    return new DeterministicFakePaymentAdapter();
  }
  if (configured.length === required.length) return new EnvPaymentProviderAdapter(env);
  throw new Error("Payment provider environment configuration is incomplete.");
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
  for (const char of value) current = (current * 31 + char.codePointAt(0)!) >>> 0;
  return current.toString(16).padStart(8, "0");
}

function localTransaction(transactionId: string, attempt: PaymentAttemptDto, status: LocalTransactionDto["status"]): LocalTransactionDto {
  return {
    transactionId,
    transactionNumber: `TX-${transactionId}`,
    reference: `REF-${transactionId}`,
    status,
    amountInCents: attempt.totals.total.amount,
    currency: "COP",
    installments: attempt.installments,
    providerTransactionId: `provider_${transactionId}`,
    safeReason: status === "FAILED" ? "The card payment was declined." : "Approved by fake provider"
  };
}

function delivery(transaction: LocalTransactionDto, attempt: PaymentAttemptDto): DeliveryAssignmentDto {
  const now = new Date(0).toISOString();
  return {
    deliveryId: `del_${transaction.transactionId}`,
    status: "READY_FOR_DELIVERY",
    transactionId: transaction.transactionId,
    reference: transaction.reference,
    items: attempt.cartItems,
    customerName: attempt.identity.fullName,
    customerEmail: attempt.identity.email,
    totals: attempt.totals,
    currency: "COP",
    createdAt: now,
    updatedAt: now
  };
}
