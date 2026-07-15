import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { CartItemDto, CatalogItemDto, CheckoutIdentityDto, DeliveryAssignmentDto, LocalTransactionDto, PaymentAttemptDto, ProviderTransactionResultDto, TransactionResultDto } from "@cardpay/contracts";
import { calculateCartTotals, mapProviderStatus, sanitizeProviderReason, shouldApplyFulfillment } from "@cardpay/core";
import { CATALOG_PORT, PAYMENT_PROVIDER_PORT, STOCK_PORT, TRANSACTION_REPOSITORY_PORT } from "./tokens";
import type { CatalogPort, PaymentProviderPort, StockPort, TransactionRecord, TransactionRepositoryPort } from "./ports";

const MAX_PROVIDER_POLLS = 3;

/** Pure computation result: the final `TransactionResultDto` plus whether committing it requires releasing reserved stock. */
interface TransactionOutcome {
  result: TransactionResultDto;
  releaseStock: boolean;
}

/**
 * Given a transaction record already mutated with a resolved provider
 * status/safeReason, decides the final `TransactionResultDto` -- but does
 * NOT itself call `stock.releaseStock`. Shared by both
 * `CreateTransactionUseCase.authorizeSafely` (first authorization attempt)
 * and `GetTransactionStatusUseCase` (later reconciliation of a PENDING
 * transaction) so the branching logic is never duplicated.
 *
 * Deliberately kept side-effect-free (pure): `GetTransactionStatusUseCase`
 * must only release stock AFTER it has won the `saveIfStatus` conditional
 * write race, otherwise two concurrent reconciliation calls resolving the
 * same PENDING transaction could both release stock for the same order.
 * Each caller applies `releaseStock` itself, at the point where it is safe
 * to do so.
 *
 * Deviation from design note: kept as a module-level function (not a
 * private method on `CreateTransactionUseCase`) because `GetTransactionStatusUseCase`
 * does not inject `CreateTransactionUseCase` -- its constructor only takes
 * the repository/provider/stock ports, so a shared free function is the
 * only way for both use cases to call one code path without adding an
 * unrequested DI edge between the two use cases.
 */
function computeTransactionOutcome(transaction: LocalTransactionDto, cartItems: CartItemDto[], identity: CheckoutIdentityDto): TransactionOutcome {
  if (transaction.status === "PENDING") {
    return { result: { status: "PENDING", transactionId: transaction.transactionId, message: "The payment is still pending confirmation.", transaction }, releaseStock: false };
  }

  if (!shouldApplyFulfillment(transaction.status)) {
    return {
      result: {
        status: "failed",
        transactionId: transaction.transactionId,
        reasonCode: transaction.status === "FAILED" ? "payment_declined" : "provider_error",
        retryable: transaction.status === "RETRYABLE",
        message: transaction.safeReason ?? "The payment could not be completed.",
        transaction
      },
      releaseStock: true
    };
  }

  const deliveryAssignment = buildDeliveryAssignment(transaction, cartItems, identity);
  transaction.deliveryAssignment = deliveryAssignment;
  return { result: { status: "succeeded", transactionId: transaction.transactionId, message: "The payment was approved.", transaction, deliveryAssignment }, releaseStock: false };
}

/** Mutates `transaction` in place with a resolved provider poll result (status mapping + safe reason). Pure aside from that mutation. */
function applyProviderResult(transaction: LocalTransactionDto, providerResult: ProviderTransactionResultDto): void {
  if (providerResult.providerTransactionId) transaction.providerTransactionId = providerResult.providerTransactionId;
  transaction.status = mapProviderStatus(providerResult.status);
  transaction.safeReason = sanitizeProviderReason(providerResult.safeReason);
}

function buildDeliveryAssignment(transaction: LocalTransactionDto, cartItems: CartItemDto[], identity: CheckoutIdentityDto): DeliveryAssignmentDto {
  const now = new Date().toISOString();
  return {
    deliveryId: `del_${transaction.transactionId}`,
    status: "READY_FOR_DELIVERY",
    transactionId: transaction.transactionId,
    reference: transaction.reference,
    items: cartItems,
    customerName: identity.fullName,
    customerEmail: identity.email,
    totals: calculateCartTotals(cartItems),
    currency: "COP",
    createdAt: now,
    updatedAt: now
  };
}

@Injectable()
export class GetCatalogUseCase {
  constructor(@Inject(CATALOG_PORT) private readonly catalog: CatalogPort) {}

  execute(): Promise<CatalogItemDto[]> {
    return this.catalog.list();
  }
}

@Injectable()
export class CreateTransactionUseCase {
  private readonly logger = new Logger(CreateTransactionUseCase.name);

  constructor(
    @Inject(CATALOG_PORT) private readonly catalog: CatalogPort,
    @Inject(STOCK_PORT) private readonly stock: StockPort,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(TRANSACTION_REPOSITORY_PORT) private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    const result = await this.authorizeSafely(attempt);
    await this.transactions.save({ result, cartItems: attempt.cartItems, createdAt: new Date(0).toISOString(), identity: attempt.identity });
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
      const { acceptanceToken, personalDataAuthToken } = await this.paymentProvider.fetchAcceptanceToken();
      const { providerTransactionId } = await this.paymentProvider.createTransaction({
        reference: transaction.reference,
        amountInCents: transaction.amountInCents,
        currency: transaction.currency,
        installments: attempt.installments,
        cardToken,
        acceptanceToken,
        personalDataAuthToken,
        customerEmail: attempt.identity.email
      });
      transaction.providerTransactionId = providerTransactionId;
      const providerResult = await this.pollUntilResolved(providerTransactionId);
      applyProviderResult(transaction, providerResult);
    } catch (error) {
      this.logger.error(sanitizeProviderReason(error instanceof Error ? error.message : String(error)));
      transaction.status = "RETRYABLE";
      transaction.safeReason = "The payment provider could not process the request.";
    }

    const outcome = computeTransactionOutcome(transaction, attempt.cartItems, attempt.identity);
    if (outcome.releaseStock) await this.stock.releaseStock(attempt.cartItems);
    return outcome.result;
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
    // transactionId must be unguessable, not just unique: GetTransactionStatusUseCase
    // exposes it via GET /transactions/:transactionId with no ownership/auth check
    // (this app has no login/session system at all - every checkout is a guest
    // checkout), so the id itself is the only thing standing between a caller
    // and another customer's name/email/order details. A bare timestamp
    // (`txn_${now}`) is trivially enumerable; randomUUID() gives it real entropy.
    return { transactionId: `txn_${randomUUID()}`, transactionNumber: `TX-${now}`, reference: `REF-${now}`, status: "PENDING", amountInCents: attempt.totals.total.amount, currency: "COP", installments: attempt.installments };
  }
}

/**
 * Resolves a previously-created transaction that came back PENDING from
 * bounded polling at creation time (see `CreateTransactionUseCase`'s
 * `MAX_PROVIDER_POLLS` limit). Safe to call repeatedly and idempotently:
 * an already-terminal transaction is returned unchanged with no new
 * provider call, and a concurrent reconciliation race is resolved via
 * `saveIfStatus`'s conditional write rather than double-applying stock
 * release or delivery assignment.
 */
@Injectable()
export class GetTransactionStatusUseCase {
  private readonly logger = new Logger(GetTransactionStatusUseCase.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY_PORT) private readonly transactions: TransactionRepositoryPort,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(STOCK_PORT) private readonly stock: StockPort
  ) {}

  async execute(transactionId: string): Promise<TransactionResultDto> {
    const record = await this.transactions.findById(transactionId);
    if (!record) throw new NotFoundException(`Transaction ${transactionId} was not found.`);
    if (record.result.status !== "PENDING") return record.result;

    const providerTransactionId = record.result.transaction.providerTransactionId;
    if (!providerTransactionId) {
      this.logger.error(`PENDING transaction ${transactionId} is missing a providerTransactionId; cannot reconcile.`);
      return record.result;
    }

    // A transient failure of OUR OWN call to the provider (network blip,
    // provider temporarily unreachable) must NOT be treated the same as the
    // provider explicitly reporting the transaction itself as errored.
    // Unlike the single-shot creation flow, this endpoint exists specifically
    // to be retried repeatedly (the mobile client polls it up to 15 times
    // over ~1 minute) -- collapsing the very first transient hiccup into a
    // permanent FAILED/RETRYABLE outcome (with stock released) would
    // foreclose every one of those remaining attempts for what might be a
    // completely healthy, still-processing payment. So: if our own call
    // fails, leave the transaction PENDING and let a later poll try again;
    // only an explicit status the provider actually returned (including a
    // genuine "ERROR" status value) is mapped to a terminal outcome.
    const providerResult = await this.pollOnceOrUndefined(providerTransactionId);
    if (!providerResult) return record.result;

    // Clone before mutating: `findById` may return the SAME object reference
    // still held by the repository's own storage (true for the in-memory
    // adapter). Mutating it in place would corrupt the "currently stored"
    // comparison `saveIfStatus` relies on for its race guard -- the stored
    // record's status would already reflect this call's own in-progress
    // change by the time the conditional write runs, making it always
    // appear to have "lost" against itself.
    const transaction: LocalTransactionDto = { ...record.result.transaction };
    applyProviderResult(transaction, providerResult);
    const outcome = computeTransactionOutcome(transaction, record.cartItems, record.identity);

    if (outcome.result.status === "PENDING") {
      // Nothing changed: still PENDING, no repository write and no side effects.
      return outcome.result;
    }

    const updatedRecord: TransactionRecord = { ...record, result: outcome.result };
    const won = await this.transactions.saveIfStatus(updatedRecord, "PENDING");
    if (!won) {
      // Lost the race: another concurrent call already resolved this
      // transaction and committed its own outcome. Do NOT release stock or
      // otherwise apply this call's own side effects -- return the winner's
      // already-committed record instead, so callers never see a state this
      // call believed but didn't actually win.
      const winningRecord = await this.transactions.findById(transactionId);
      return winningRecord?.result ?? outcome.result;
    }

    // Only release stock once this call has confirmed it is the one that
    // committed the terminal outcome -- never before winning the race.
    if (outcome.releaseStock) await this.stock.releaseStock(record.cartItems);
    return outcome.result;
  }

  private async pollOnceOrUndefined(providerTransactionId: string): Promise<ProviderTransactionResultDto | undefined> {
    try {
      return await this.paymentProvider.pollTransaction(providerTransactionId);
    } catch (error) {
      this.logger.error(sanitizeProviderReason(error instanceof Error ? error.message : String(error)));
      return undefined;
    }
  }
}
