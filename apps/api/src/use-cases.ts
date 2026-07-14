import { Inject, Injectable } from "@nestjs/common";
import type { CatalogItemDto, DeliveryAssignmentDto, LocalTransactionDto, PaymentAttemptDto, TransactionResultDto } from "@cardpay/contracts";
import { calculateCartTotals, mapProviderStatus, sanitizeProviderReason, shouldApplyFulfillment } from "@cardpay/core";
import { CATALOG_PORT, PAYMENT_PROVIDER_PORT, STOCK_PORT, TRANSACTION_REPOSITORY_PORT } from "./tokens";
import type { CatalogPort, PaymentProviderPort, StockPort, TransactionRepositoryPort } from "./ports";

const MAX_PROVIDER_POLLS = 3;

@Injectable()
export class GetCatalogUseCase {
  constructor(@Inject(CATALOG_PORT) private readonly catalog: CatalogPort) {}

  execute(): Promise<CatalogItemDto[]> {
    return this.catalog.list();
  }
}

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(CATALOG_PORT) private readonly catalog: CatalogPort,
    @Inject(STOCK_PORT) private readonly stock: StockPort,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(TRANSACTION_REPOSITORY_PORT) private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    const result = await this.authorizeSafely(attempt);
    await this.transactions.save({ result, cartItems: attempt.cartItems, createdAt: new Date(0).toISOString() });
    return result;
  }

  private async authorizeSafely(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    const transaction = this.pendingTransaction(attempt);
    const catalogItems = await this.catalog.list();
    if (!this.hasKnownCatalogItems(attempt, catalogItems)) return this.stockRejectedResult(attempt.identity.email, transaction);
    if (!this.hasServerOwnedTotals(attempt, catalogItems)) return this.validationRejectedResult(transaction);
    if (!(await this.stock.reserveStock(attempt.cartItems))) return this.stockRejectedResult(attempt.identity.email, transaction);
    try {
      const { cardToken } = await this.paymentProvider.tokenizeCard(attempt.card);
      const { acceptanceToken } = await this.paymentProvider.fetchAcceptanceToken();
      const { providerTransactionId } = await this.paymentProvider.createTransaction({
        reference: transaction.reference,
        amountInCents: transaction.amountInCents,
        currency: transaction.currency,
        installments: attempt.installments,
        cardToken,
        acceptanceToken,
        customerEmail: attempt.identity.email
      });
      const providerResult = await this.pollUntilResolved(providerTransactionId);
      transaction.providerTransactionId = providerTransactionId;
      transaction.status = mapProviderStatus(providerResult.status);
      transaction.safeReason = sanitizeProviderReason(providerResult.safeReason);
    } catch {
      transaction.status = "RETRYABLE";
      transaction.safeReason = "The payment provider could not process the request.";
    }

    if (transaction.status === "PENDING") {
      return { status: "PENDING", transactionId: transaction.transactionId, message: "The payment is still pending confirmation.", transaction };
    }

    if (!shouldApplyFulfillment(transaction.status)) {
      await this.stock.releaseStock(attempt.cartItems);
      return { status: "failed", transactionId: transaction.transactionId, reasonCode: transaction.status === "FAILED" ? "payment_declined" : "provider_error", retryable: transaction.status === "RETRYABLE", message: transaction.safeReason, transaction };
    }

    const deliveryAssignment = this.delivery(transaction, attempt);
    transaction.deliveryAssignment = deliveryAssignment;
    return { status: "succeeded", transactionId: transaction.transactionId, message: "The payment was approved.", transaction, deliveryAssignment };
  }

  private hasKnownCatalogItems(attempt: PaymentAttemptDto, catalogItems: CatalogItemDto[]): boolean {
    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
    return attempt.cartItems.every((item) => catalogById.has(item.productId));
  }

  private hasServerOwnedTotals(attempt: PaymentAttemptDto, catalogItems: CatalogItemDto[]): boolean {
    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
    const serverItems = attempt.cartItems.map((item) => ({ ...item, unitPrice: catalogById.get(item.productId)!.unitPrice }));
    return JSON.stringify(calculateCartTotals(serverItems)) === JSON.stringify(attempt.totals) && serverItems.every((item, index) => item.unitPrice.amount === attempt.cartItems[index]!.unitPrice.amount);
  }

  private async pollUntilResolved(providerTransactionId: string) {
    let last = await this.paymentProvider.pollTransaction(providerTransactionId);
    for (let attempt = 1; last.status === "PENDING" && attempt < MAX_PROVIDER_POLLS; attempt += 1) {
      last = await this.paymentProvider.pollTransaction(providerTransactionId);
    }
    return last;
  }

  private stockRejectedResult(email: string, transaction?: LocalTransactionDto): TransactionResultDto {
    if (transaction) {
      transaction.status = "FAILED";
      transaction.safeReason = "One or more items are no longer available.";
    }
    return { status: "failed", transactionId: transaction?.transactionId ?? `stock_${email.length}`, reasonCode: "stock_unavailable", retryable: false, message: "One or more items are no longer available.", transaction };
  }

  private validationRejectedResult(transaction: LocalTransactionDto): TransactionResultDto {
    transaction.status = "FAILED";
    transaction.safeReason = "Cart totals must match the backend catalog.";
    return { status: "failed", transactionId: transaction.transactionId, reasonCode: "validation_error", retryable: false, message: "Cart totals must match the backend catalog.", transaction };
  }

  private pendingTransaction(attempt: PaymentAttemptDto): LocalTransactionDto {
    const now = Date.now();
    return { transactionId: `txn_${now}`, transactionNumber: `TX-${now}`, reference: `REF-${now}`, status: "PENDING", amountInCents: attempt.totals.total.amount, currency: "COP", installments: attempt.installments };
  }

  private delivery(transaction: LocalTransactionDto, attempt: PaymentAttemptDto): DeliveryAssignmentDto {
    const now = new Date().toISOString();
    return { deliveryId: `del_${transaction.transactionId}`, status: "READY_FOR_DELIVERY", transactionId: transaction.transactionId, reference: transaction.reference, items: attempt.cartItems, customerName: attempt.identity.fullName, customerEmail: attempt.identity.email, totals: attempt.totals, currency: "COP", createdAt: now, updatedAt: now };
  }
}
