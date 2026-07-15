import { InMemoryCatalogAdapter, InMemoryTransactionRepository } from "./adapters";
import { DynamoDbCatalogAdapter, DynamoDbTransactionRepository } from "./dynamodb-adapters";
import { createCatalogPort, createTransactionRepositoryPort } from "./persistence-config";

describe("persistence-config", () => {
  describe("createCatalogPort", () => {
    it("returns the in-memory adapter instance when DYNAMODB_ENDPOINT is unset", () => {
      const memory = new InMemoryCatalogAdapter();

      const port = createCatalogPort(memory, {});

      expect(port).toBe(memory);
    });

    it("returns a DynamoDB-backed adapter when DYNAMODB_ENDPOINT is set", () => {
      const memory = new InMemoryCatalogAdapter();

      const port = createCatalogPort(memory, { DYNAMODB_ENDPOINT: "http://localhost:8000" });

      expect(port).toBeInstanceOf(DynamoDbCatalogAdapter);
      expect(port).not.toBe(memory);
    });

    it("fails fast instead of falling back to in-memory catalog storage when running in production without DYNAMODB_ENDPOINT", () => {
      const memory = new InMemoryCatalogAdapter();

      expect(() => createCatalogPort(memory, { NODE_ENV: "production" })).toThrow("DYNAMODB_ENDPOINT is required in production");
    });
  });

  describe("createTransactionRepositoryPort", () => {
    it("returns the in-memory repository instance when DYNAMODB_ENDPOINT is unset", () => {
      const memory = new InMemoryTransactionRepository();

      const port = createTransactionRepositoryPort(memory, {});

      expect(port).toBe(memory);
    });

    it("returns a DynamoDB-backed repository when DYNAMODB_ENDPOINT is set", () => {
      const memory = new InMemoryTransactionRepository();

      const port = createTransactionRepositoryPort(memory, { DYNAMODB_ENDPOINT: "http://localhost:8000" });

      expect(port).toBeInstanceOf(DynamoDbTransactionRepository);
      expect(port).not.toBe(memory);
    });

    it("fails fast instead of falling back to in-memory transaction storage when running in production without DYNAMODB_ENDPOINT", () => {
      const memory = new InMemoryTransactionRepository();

      expect(() => createTransactionRepositoryPort(memory, { NODE_ENV: "production" })).toThrow("DYNAMODB_ENDPOINT is required in production");
    });
  });
});
