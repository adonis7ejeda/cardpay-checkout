import type { LocalTransactionStatus } from "@cardpay/contracts";
import type { TransactionRecord, TransactionRepositoryPort } from "../application/ports";

export class InMemoryTransactionRepository implements TransactionRepositoryPort {
  private readonly records: TransactionRecord[] = [];

  async save(record: TransactionRecord): Promise<TransactionRecord> {
    const index = this.records.findIndex((existing) => existing.result.transactionId === record.result.transactionId);
    if (index === -1) this.records.push(record);
    else this.records[index] = record;
    return record;
  }

  async all(): Promise<TransactionRecord[]> {
    return [...this.records];
  }

  async findById(transactionId: string): Promise<TransactionRecord | undefined> {
    return this.records.find((record) => record.result.transactionId === transactionId);
  }

  async saveIfStatus(record: TransactionRecord, expectedCurrentStatus: LocalTransactionStatus): Promise<boolean> {
    // Check-then-write with no `await` between them: an async function body
    // runs synchronously up to its first `await`, so keeping both the read
    // and the write in that same synchronous span (rather than two separate
    // awaited calls) prevents another concurrent saveIfStatus call from
    // interleaving between the check and the write - the same atomicity
    // DynamoDbTransactionRepository gets from a ConditionExpression, without
    // a real database underneath.
    const index = this.records.findIndex((existing) => existing.result.transactionId === record.result.transactionId);
    if (index === -1 || this.records[index]!.result.transaction?.status !== expectedCurrentStatus) return false;
    this.records[index] = record;
    return true;
  }
}
