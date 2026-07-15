import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { CartItemDto, CatalogItemDto, LocalTransactionStatus } from "@cardpay/contracts";
import { CATALOG_SEED } from "./catalog-data";
import type { CatalogPort, StockPort, TransactionRecord, TransactionRepositoryPort } from "../application/ports";

export class DynamoDbTransactionRepository implements TransactionRepositoryPort {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async save(record: TransactionRecord): Promise<TransactionRecord> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { transactionId: record.result.transactionId, createdAt: record.createdAt, payload: JSON.stringify(record), status: this.statusOf(record) }
      })
    );
    return record;
  }

  async all(): Promise<TransactionRecord[]> {
    const response = await this.client.send(new ScanCommand({ TableName: this.tableName }));
    return (response.Items ?? []).map((item) => JSON.parse(item.payload as string) as TransactionRecord);
  }

  async findById(transactionId: string): Promise<TransactionRecord | undefined> {
    const response = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { transactionId } }));
    if (!response.Item) return undefined;
    return JSON.parse(response.Item.payload as string) as TransactionRecord;
  }

  async saveIfStatus(record: TransactionRecord, expectedCurrentStatus: LocalTransactionStatus): Promise<boolean> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { transactionId: record.result.transactionId, createdAt: record.createdAt, payload: JSON.stringify(record), status: this.statusOf(record) },
          ConditionExpression: "#status = :expected",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":expected": expectedCurrentStatus }
        })
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  private statusOf(record: TransactionRecord): LocalTransactionStatus | undefined {
    return record.result.transaction?.status;
  }
}

export class DynamoDbCatalogAdapter implements CatalogPort, StockPort {
  private seeded: Promise<void> | null = null;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly catalogSeed: CatalogItemDto[] = CATALOG_SEED
  ) {}

  async list(): Promise<CatalogItemDto[]> {
    await this.ensureSeeded();
    const items: CatalogItemDto[] = [];
    for (const item of this.catalogSeed) {
      const stockAvailable = await this.currentStock(item.id);
      items.push({ ...item, stockAvailable, purchasable: stockAvailable > 0 });
    }
    return items;
  }

  async reserveStock(items: CartItemDto[]): Promise<boolean> {
    await this.ensureSeeded();
    const reserved: CartItemDto[] = [];
    try {
      for (const item of items) {
        await this.adjustStock(item, "-");
        reserved.push(item);
      }
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        await this.releaseStock(reserved);
        return false;
      }
      throw error;
    }
  }

  async releaseStock(items: CartItemDto[]): Promise<void> {
    await this.ensureSeeded();
    for (const item of items) {
      await this.adjustStock(item, "+");
    }
  }

  /** Writes each catalog item's initial stock exactly once; safe under concurrent instances via a conditional put. */
  private async ensureSeeded(): Promise<void> {
    if (!this.seeded) {
      this.seeded = this.seedAll().catch((error) => {
        // Do not memoize a rejection: a transient failure (throttling,
        // network error) must not permanently poison this adapter instance
        // for the rest of a warm Lambda container's lifetime -- the next
        // call should retry seeding from scratch.
        this.seeded = null;
        throw error;
      });
    }
    return this.seeded;
  }

  private async seedAll(): Promise<void> {
    for (const item of this.catalogSeed) {
      try {
        await this.client.send(
          new PutCommand({
            TableName: this.tableName,
            Item: { productId: item.id, stockAvailable: item.stockAvailable },
            ConditionExpression: "attribute_not_exists(productId)"
          })
        );
      } catch (error) {
        if (!(error instanceof ConditionalCheckFailedException)) throw error;
      }
    }
  }

  private async adjustStock(item: CartItemDto, operator: "+" | "-"): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { productId: item.productId },
        UpdateExpression: `SET stockAvailable = stockAvailable ${operator} :qty`,
        ...(operator === "-" ? { ConditionExpression: "stockAvailable >= :qty" } : {}),
        ExpressionAttributeValues: { ":qty": item.quantity }
      })
    );
  }

  private async currentStock(productId: string): Promise<number> {
    const response = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { productId } }));
    return (response.Item?.stockAvailable as number | undefined) ?? 0;
  }
}
