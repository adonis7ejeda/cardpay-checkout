import type { CatalogPort, StockPort, TransactionRepositoryPort } from "../application/ports";
import { catalogStockTableName, createDynamoDbDocumentClient, transactionsTableName } from "./dynamodb-client";
import { DynamoDbCatalogAdapter, DynamoDbTransactionRepository } from "./dynamodb-adapters";

/**
 * Selects the catalog/stock port implementation.
 *
 * Local default (DYNAMODB_ENDPOINT unset): reuse the given in-memory adapter
 * instance unchanged, so PR1's existing behavior and DI wiring are untouched.
 * When DYNAMODB_ENDPOINT is set: build a DynamoDB-backed adapter pointed at
 * that endpoint (DynamoDB Local for dev, real AWS DynamoDB in production).
 */
export function createCatalogPort(memoryAdapter: CatalogPort & StockPort, env: NodeJS.ProcessEnv = process.env): CatalogPort & StockPort {
  if (!env.DYNAMODB_ENDPOINT) {
    if (env.NODE_ENV === "production") throw new Error("DYNAMODB_ENDPOINT is required in production; refusing to fall back to in-memory catalog/stock storage.");
    return memoryAdapter;
  }
  const client = createDynamoDbDocumentClient(env);
  return new DynamoDbCatalogAdapter(client, catalogStockTableName(env));
}

/**
 * Selects the transaction repository port implementation using the same
 * env-driven rule as `createCatalogPort`.
 */
export function createTransactionRepositoryPort(memoryRepository: TransactionRepositoryPort, env: NodeJS.ProcessEnv = process.env): TransactionRepositoryPort {
  if (!env.DYNAMODB_ENDPOINT) {
    if (env.NODE_ENV === "production") throw new Error("DYNAMODB_ENDPOINT is required in production; refusing to fall back to in-memory transaction storage.");
    return memoryRepository;
  }
  const client = createDynamoDbDocumentClient(env);
  return new DynamoDbTransactionRepository(client, transactionsTableName(env));
}
