import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./interface/app.module";
import { InMemoryCatalogAdapter } from "./infrastructure/catalog.adapter";
import { InMemoryTransactionRepository } from "./infrastructure/transaction-repository.adapter";
import { DynamoDbCatalogAdapter, DynamoDbTransactionRepository } from "./infrastructure/dynamodb-adapters";
import { CATALOG_PORT, STOCK_PORT, TRANSACTION_REPOSITORY_PORT } from "./application/tokens";

describe("AppModule persistence wiring", () => {
  const clearEnv = () => {
    delete process.env.DYNAMODB_ENDPOINT;
    delete process.env.PAYMENT_PROVIDER_PUBLIC_KEY;
    delete process.env.PAYMENT_PROVIDER_INTEGRITY_SECRET;
    delete process.env.PAYMENT_PROVIDER_BASE_URL;
  };

  beforeEach(clearEnv);
  afterEach(clearEnv);

  it("boots credential-free by default and wires the in-memory catalog/stock/transaction ports", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    const memoryCatalog = moduleRef.get(InMemoryCatalogAdapter);
    const memoryRepo = moduleRef.get(InMemoryTransactionRepository);

    expect(moduleRef.get(CATALOG_PORT)).toBe(memoryCatalog);
    expect(moduleRef.get(STOCK_PORT)).toBe(memoryCatalog);
    expect(moduleRef.get(TRANSACTION_REPOSITORY_PORT)).toBe(memoryRepo);

    await app.close();
  });

  it("wires DynamoDB-backed catalog/stock/transaction ports when DYNAMODB_ENDPOINT is set, without requiring AWS credentials to boot", async () => {
    process.env.DYNAMODB_ENDPOINT = "http://localhost:8000";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await expect(app.init()).resolves.not.toThrow();

    expect(moduleRef.get(CATALOG_PORT)).toBeInstanceOf(DynamoDbCatalogAdapter);
    expect(moduleRef.get(STOCK_PORT)).toBeInstanceOf(DynamoDbCatalogAdapter);
    expect(moduleRef.get(CATALOG_PORT)).toBe(moduleRef.get(STOCK_PORT));
    expect(moduleRef.get(TRANSACTION_REPOSITORY_PORT)).toBeInstanceOf(DynamoDbTransactionRepository);

    await app.close();
  });
});
