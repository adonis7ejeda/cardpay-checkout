import { Module } from "@nestjs/common";
import { createDefaultPaymentProvider, InMemoryCatalogAdapter, InMemoryTransactionRepository } from "./adapters";
import { CheckoutController } from "./controllers";
import { createCatalogPort, createTransactionRepositoryPort } from "./persistence-config";
import { CATALOG_PORT, PAYMENT_PROVIDER_PORT, STOCK_PORT, TRANSACTION_REPOSITORY_PORT } from "./tokens";
import { CreateTransactionUseCase, GetCatalogUseCase, GetTransactionStatusUseCase } from "./use-cases";

@Module({
  controllers: [CheckoutController],
  providers: [
    InMemoryCatalogAdapter,
    InMemoryTransactionRepository,
    GetCatalogUseCase,
    CreateTransactionUseCase,
    GetTransactionStatusUseCase,
    { provide: CATALOG_PORT, useFactory: (memory: InMemoryCatalogAdapter) => createCatalogPort(memory), inject: [InMemoryCatalogAdapter] },
    { provide: STOCK_PORT, useExisting: CATALOG_PORT },
    { provide: PAYMENT_PROVIDER_PORT, useFactory: () => createDefaultPaymentProvider() },
    { provide: TRANSACTION_REPOSITORY_PORT, useFactory: (memory: InMemoryTransactionRepository) => createTransactionRepositoryPort(memory), inject: [InMemoryTransactionRepository] }
  ]
})
export class AppModule {}
