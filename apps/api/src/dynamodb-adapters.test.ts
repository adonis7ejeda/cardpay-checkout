import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import type { CartItemDto } from "@cardpay/contracts";
import { DynamoDbCatalogAdapter, DynamoDbTransactionRepository } from "./dynamodb-adapters";
import type { TransactionRecord } from "./ports";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("DynamoDbTransactionRepository", () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  const repository = new DynamoDbTransactionRepository(client, "cardpay-transactions-test");

  const record: TransactionRecord = {
    result: { status: "succeeded", transactionId: "txn_1", message: "The payment was approved.", transaction: { transactionId: "txn_1", transactionNumber: "TX-1", reference: "REF-1", status: "APPROVED", amountInCents: 1000, currency: "COP", installments: 1 } },
    cartItems: [{ productId: "basic-tee", quantity: 1, unitPrice: { amount: 1000, currency: "COP" } }],
    createdAt: "2026-01-01T00:00:00.000Z"
  };

  beforeEach(() => {
    ddbMock.reset();
  });

  it("saves a transaction record as a serialized item keyed by transactionId", async () => {
    ddbMock.on(PutCommand).resolves({});

    const saved = await repository.save(record);

    expect(saved).toEqual(record);
    const call = ddbMock.commandCalls(PutCommand)[0];
    expect(call?.args[0].input).toMatchObject({
      TableName: "cardpay-transactions-test",
      Item: { transactionId: "txn_1", createdAt: record.createdAt, payload: JSON.stringify(record) }
    });
  });

  it("returns every stored record parsed back from the scan payload", async () => {
    const other: TransactionRecord = { ...record, result: { ...record.result, transactionId: "txn_2" }, createdAt: "2026-01-02T00:00:00.000Z" };
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { transactionId: "txn_1", createdAt: record.createdAt, payload: JSON.stringify(record) },
        { transactionId: "txn_2", createdAt: other.createdAt, payload: JSON.stringify(other) }
      ]
    });

    const all = await repository.all();

    expect(all).toEqual([record, other]);
  });

  it("returns an empty array when the table has no records yet", async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    const all = await repository.all();

    expect(all).toEqual([]);
  });
});

describe("DynamoDbCatalogAdapter", () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
  const adapter = new DynamoDbCatalogAdapter(client, "cardpay-catalog-stock-test");

  beforeEach(() => {
    ddbMock.reset();
  });

  it("lists catalog items with stock read live from DynamoDB", async () => {
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(GetCommand, { TableName: "cardpay-catalog-stock-test", Key: { productId: "basic-tee" } }).resolves({ Item: { productId: "basic-tee", stockAvailable: 4 } });
    ddbMock.on(GetCommand, { TableName: "cardpay-catalog-stock-test", Key: { productId: "canvas-tote" } }).resolves({ Item: { productId: "canvas-tote", stockAvailable: 0 } });

    const items = await adapter.list();

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "basic-tee", stockAvailable: 4, purchasable: true }),
        expect.objectContaining({ id: "canvas-tote", stockAvailable: 0, purchasable: false })
      ])
    );
  });

  it("seeds every catalog item into DynamoDB on first use, without overwriting an already-seeded item", async () => {
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(GetCommand).resolves({ Item: { stockAvailable: 4 } });
    const freshAdapter = new DynamoDbCatalogAdapter(client, "cardpay-catalog-stock-test");

    await freshAdapter.list();

    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(2);
    expect(putCalls[0]?.args[0].input).toMatchObject({
      TableName: "cardpay-catalog-stock-test",
      Item: { productId: "basic-tee", stockAvailable: 4 },
      ConditionExpression: "attribute_not_exists(productId)"
    });
    expect(putCalls[1]?.args[0].input).toMatchObject({
      TableName: "cardpay-catalog-stock-test",
      Item: { productId: "canvas-tote", stockAvailable: 2 },
      ConditionExpression: "attribute_not_exists(productId)"
    });

    await freshAdapter.list();
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(2);
  });

  it("does not fail seeding when an item already exists in the table", async () => {
    ddbMock.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: "conditional failed", $metadata: {} }));
    ddbMock.on(GetCommand).resolves({ Item: { stockAvailable: 4 } });
    const freshAdapter = new DynamoDbCatalogAdapter(client, "cardpay-catalog-stock-test");

    await expect(freshAdapter.list()).resolves.toBeDefined();
  });

  it("retries seeding on the next call instead of permanently failing after a transient error", async () => {
    ddbMock.on(PutCommand).rejectsOnce(new Error("ProvisionedThroughputExceededException")).resolves({});
    ddbMock.on(GetCommand).resolves({ Item: { stockAvailable: 4 } });
    const freshAdapter = new DynamoDbCatalogAdapter(client, "cardpay-catalog-stock-test");

    await expect(freshAdapter.list()).rejects.toThrow("ProvisionedThroughputExceededException");
    await expect(freshAdapter.list()).resolves.toBeDefined();
  });

  it("treats a missing stock item as zero stock and not purchasable", async () => {
    ddbMock.on(GetCommand).resolves({});

    const items = await adapter.list();

    expect(items).toEqual(expect.arrayContaining([expect.objectContaining({ id: "basic-tee", stockAvailable: 0, purchasable: false })]));
  });

  it("reserves stock by conditionally decrementing each requested item", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const items: CartItemDto[] = [{ productId: "basic-tee", quantity: 2, unitPrice: { amount: 45000, currency: "COP" } }];

    const reserved = await adapter.reserveStock(items);

    expect(reserved).toBe(true);
    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call?.args[0].input).toMatchObject({
      TableName: "cardpay-catalog-stock-test",
      Key: { productId: "basic-tee" },
      ConditionExpression: "stockAvailable >= :qty",
      ExpressionAttributeValues: { ":qty": 2 }
    });
  });

  it("rolls back already-reserved items and returns false when any item lacks stock", async () => {
    ddbMock
      .on(UpdateCommand, { TableName: "cardpay-catalog-stock-test", Key: { productId: "basic-tee" }, UpdateExpression: "SET stockAvailable = stockAvailable - :qty" })
      .resolves({})
      .on(UpdateCommand, { TableName: "cardpay-catalog-stock-test", Key: { productId: "canvas-tote" }, UpdateExpression: "SET stockAvailable = stockAvailable - :qty" })
      .rejects(new ConditionalCheckFailedException({ message: "conditional failed", $metadata: {} }))
      .on(UpdateCommand, { TableName: "cardpay-catalog-stock-test", Key: { productId: "basic-tee" }, UpdateExpression: "SET stockAvailable = stockAvailable + :qty" })
      .resolves({});
    const items: CartItemDto[] = [
      { productId: "basic-tee", quantity: 1, unitPrice: { amount: 45000, currency: "COP" } },
      { productId: "canvas-tote", quantity: 1, unitPrice: { amount: 32000, currency: "COP" } }
    ];

    const reserved = await adapter.reserveStock(items);

    expect(reserved).toBe(false);
    const rollbackCalls = ddbMock.commandCalls(UpdateCommand).filter((call) => (call.args[0].input as { UpdateExpression?: string }).UpdateExpression === "SET stockAvailable = stockAvailable + :qty");
    expect(rollbackCalls).toHaveLength(1);
    expect(rollbackCalls[0]?.args[0].input).toMatchObject({ Key: { productId: "basic-tee" } });
  });

  it("releases stock by incrementing every requested item", async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const items: CartItemDto[] = [{ productId: "basic-tee", quantity: 3, unitPrice: { amount: 45000, currency: "COP" } }];

    await adapter.releaseStock(items);

    const call = ddbMock.commandCalls(UpdateCommand)[0];
    expect(call?.args[0].input).toMatchObject({
      TableName: "cardpay-catalog-stock-test",
      Key: { productId: "basic-tee" },
      UpdateExpression: "SET stockAvailable = stockAvailable + :qty",
      ExpressionAttributeValues: { ":qty": 3 }
    });
  });
});
