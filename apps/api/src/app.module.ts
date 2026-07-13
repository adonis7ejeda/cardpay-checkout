import { Module } from "@nestjs/common";
import { InMemoryCatalogAdapter, InMemoryTransactionRepository, DeterministicFakePaymentAdapter } from "./adapters";
import { CheckoutController } from "./controllers";
import { GetCatalogUseCase, CreateTransactionUseCase } from "./use-cases";
import { CATALOG_PORT, PAYMENT_PROVIDER_PORT, STOCK_PORT, TRANSACTION_REPOSITORY_PORT } from "./tokens";

@Module({
  controllers: [CheckoutController],
  providers: [
    InMemoryCatalogAdapter,
    InMemoryTransactionRepository,
    DeterministicFakePaymentAdapter,
    GetCatalogUseCase,
    CreateTransactionUseCase,
    { provide: CATALOG_PORT, useExisting: InMemoryCatalogAdapter },
    { provide: STOCK_PORT, useExisting: InMemoryCatalogAdapter },
    { provide: PAYMENT_PROVIDER_PORT, useExisting: DeterministicFakePaymentAdapter },
    { provide: TRANSACTION_REPOSITORY_PORT, useExisting: InMemoryTransactionRepository },
  ],
})
export class AppModule {}
