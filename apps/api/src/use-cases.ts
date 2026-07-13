import { Inject, Injectable } from "@nestjs/common";
import type { CatalogItemDto, PaymentAttemptDto, TransactionResultDto } from "@cardpay/contracts";
import { CATALOG_PORT, PAYMENT_PROVIDER_PORT, STOCK_PORT, TRANSACTION_REPOSITORY_PORT } from "./tokens";
import type { CatalogPort, PaymentProviderPort, StockPort, TransactionRepositoryPort } from "./ports";

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
    @Inject(STOCK_PORT) private readonly stock: StockPort,
    @Inject(PAYMENT_PROVIDER_PORT) private readonly paymentProvider: PaymentProviderPort,
    @Inject(TRANSACTION_REPOSITORY_PORT) private readonly transactions: TransactionRepositoryPort,
  ) {}

  async execute(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    const result = (await this.stock.hasStock(attempt.cartItems))
      ? await this.authorizeSafely(attempt)
      : this.stockRejectedResult(attempt.identity.email);

    await this.transactions.save({ result, cartItems: attempt.cartItems, createdAt: new Date(0).toISOString() });
    return result;
  }

  private async authorizeSafely(attempt: PaymentAttemptDto): Promise<TransactionResultDto> {
    try {
      return await this.paymentProvider.authorize(attempt);
    } catch {
      return { status: "failed", transactionId: `safe_${attempt.identity.email.length}`, reasonCode: "provider_error", retryable: true, message: "The payment provider could not process the request." };
    }
  }

  private stockRejectedResult(email: string): TransactionResultDto {
    return { status: "failed", transactionId: `stock_${email.length}`, reasonCode: "stock_unavailable", retryable: false, message: "One or more items are no longer available." };
  }
}
