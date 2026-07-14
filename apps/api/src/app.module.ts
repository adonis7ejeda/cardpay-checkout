import { Module } from "@nestjs/common";
import { createDefaultPaymentProvider, InMemoryCatalogAdapter, InMemoryTransactionRepository } from "./adapters";
import { CheckoutController } from "./controllers";
import { CATALOG_PORT, PAYMENT_PROVIDER_PORT, STOCK_PORT, TRANSACTION_REPOSITORY_PORT } from "./tokens";
import { CreateTransactionUseCase, GetCatalogUseCase } from "./use-cases";

@Module({
  controllers: [CheckoutController],
  providers: [
    InMemoryCatalogAdapter,
    InMemoryTransactionRepository,
    GetCatalogUseCase,
    CreateTransactionUseCase,
    { provide: CATALOG_PORT, useExisting: InMemoryCatalogAdapter },
    { provide: STOCK_PORT, useExisting: InMemoryCatalogAdapter },
    { provide: PAYMENT_PROVIDER_PORT, useFactory: () => createDefaultPaymentProvider() },
    { provide: TRANSACTION_REPOSITORY_PORT, useExisting: InMemoryTransactionRepository }
  ]
})
export class AppModule {}
