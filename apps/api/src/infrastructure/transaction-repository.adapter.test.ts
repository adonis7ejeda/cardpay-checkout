import { InMemoryTransactionRepository } from "./transaction-repository.adapter";
import type { TransactionRecord } from "../application/ports";

describe("InMemoryTransactionRepository", () => {
  const pendingRecord = (transactionId: string): TransactionRecord => ({
    result: {
      status: "PENDING",
      transactionId,
      message: "The payment is still pending confirmation.",
      transaction: { transactionId, transactionNumber: `TX-${transactionId}`, reference: `REF-${transactionId}`, status: "PENDING", amountInCents: 45000, currency: "COP", installments: 1, providerTransactionId: `provider_${transactionId}` }
    },
    cartItems: [{ productId: "basic-tee", quantity: 1, unitPrice: { amount: 45000, currency: "COP" } }],
    createdAt: "2026-01-01T00:00:00.000Z",
    identity: { fullName: "Ada Lovelace", email: "ada@example.com" }
  });

  it("returns undefined for findById when no record with that transactionId exists", async () => {
    const repository = new InMemoryTransactionRepository();

    await expect(repository.findById("missing")).resolves.toBeUndefined();
  });

  it("returns the stored record by transactionId via findById", async () => {
    const repository = new InMemoryTransactionRepository();
    const record = pendingRecord("txn_1");
    await repository.save(record);

    await expect(repository.findById("txn_1")).resolves.toEqual(record);
  });

  it("saveIfStatus writes and returns true when the stored record still has the expected status", async () => {
    const repository = new InMemoryTransactionRepository();
    const record = pendingRecord("txn_1");
    await repository.save(record);
    const resolved: TransactionRecord = { ...record, result: { status: "succeeded", transactionId: "txn_1", message: "The payment was approved.", transaction: { ...record.result.transaction!, status: "APPROVED" } } };

    const won = await repository.saveIfStatus(resolved, "PENDING");

    expect(won).toBe(true);
    await expect(repository.findById("txn_1")).resolves.toEqual(resolved);
  });

  it("saveIfStatus returns false and does not overwrite when the stored status already moved on (lost race)", async () => {
    const repository = new InMemoryTransactionRepository();
    const record = pendingRecord("txn_1");
    const alreadyResolved: TransactionRecord = { ...record, result: { status: "succeeded", transactionId: "txn_1", message: "The payment was approved.", transaction: { ...record.result.transaction!, status: "APPROVED" } } };
    await repository.save(alreadyResolved);
    const staleAttempt: TransactionRecord = { ...record, result: { status: "failed", transactionId: "txn_1", reasonCode: "payment_declined", retryable: false, message: "declined", transaction: { ...record.result.transaction!, status: "FAILED" } } };

    const won = await repository.saveIfStatus(staleAttempt, "PENDING");

    expect(won).toBe(false);
    await expect(repository.findById("txn_1")).resolves.toEqual(alreadyResolved);
  });

  it("saveIfStatus returns false when no record with that transactionId exists yet", async () => {
    const repository = new InMemoryTransactionRepository();
    const record = pendingRecord("txn_never_created");

    const won = await repository.saveIfStatus(record, "PENDING");

    expect(won).toBe(false);
    await expect(repository.findById("txn_never_created")).resolves.toBeUndefined();
  });
});
