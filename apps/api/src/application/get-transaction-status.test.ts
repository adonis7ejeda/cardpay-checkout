import { NotFoundException } from "@nestjs/common";
import type { PaymentProviderPort, StockPort, TransactionRecord, TransactionRepositoryPort } from "./ports";
import { GetTransactionStatusUseCase } from "./use-cases";

function pendingRecord(transactionId: string): TransactionRecord {
  return {
    result: {
      status: "PENDING",
      transactionId,
      message: "The payment is still pending confirmation.",
      transaction: { transactionId, transactionNumber: `TX-${transactionId}`, reference: `REF-${transactionId}`, status: "PENDING", amountInCents: 45000, currency: "COP", installments: 1, providerTransactionId: `provider_${transactionId}` }
    },
    cartItems: [{ productId: "basic-tee", quantity: 1, unitPrice: { amount: 45000, currency: "COP" } }],
    createdAt: "2026-01-01T00:00:00.000Z",
    identity: { fullName: "Ada Lovelace", email: "ada@example.com" }
  };
}

function terminalRecord(transactionId: string, status: "succeeded" | "failed"): TransactionRecord {
  const transaction = { transactionId, transactionNumber: `TX-${transactionId}`, reference: `REF-${transactionId}`, amountInCents: 45000, currency: "COP" as const, installments: 1, providerTransactionId: `provider_${transactionId}` };
  const result =
    status === "succeeded"
      ? { status: "succeeded" as const, transactionId, message: "The payment was approved.", transaction: { ...transaction, status: "APPROVED" as const } }
      : { status: "failed" as const, transactionId, reasonCode: "payment_declined" as const, retryable: false, message: "The card payment was declined.", transaction: { ...transaction, status: "FAILED" as const } };
  return { result, cartItems: [{ productId: "basic-tee", quantity: 1, unitPrice: { amount: 45000, currency: "COP" } }], createdAt: "2026-01-01T00:00:00.000Z", identity: { fullName: "Ada Lovelace", email: "ada@example.com" } };
}

function buildRepository(initial?: TransactionRecord): jest.Mocked<TransactionRepositoryPort> {
  const store = new Map<string, TransactionRecord>();
  if (initial) store.set(initial.result.transactionId, initial);
  return {
    save: jest.fn(async (record: TransactionRecord) => {
      store.set(record.result.transactionId, record);
      return record;
    }),
    all: jest.fn(async () => [...store.values()]),
    findById: jest.fn(async (transactionId: string) => store.get(transactionId)),
    saveIfStatus: jest.fn(async (record: TransactionRecord, expectedCurrentStatus) => {
      const current = store.get(record.result.transactionId);
      if (!current || current.result.transaction?.status !== expectedCurrentStatus) return false;
      store.set(record.result.transactionId, record);
      return true;
    })
  };
}

function buildProvider(pollResult: PaymentProviderPort["pollTransaction"]): jest.Mocked<PaymentProviderPort> {
  return {
    tokenizeCard: jest.fn(),
    fetchAcceptanceToken: jest.fn(),
    createTransaction: jest.fn(),
    pollTransaction: jest.fn(pollResult),
    authorize: jest.fn()
  } as unknown as jest.Mocked<PaymentProviderPort>;
}

function buildStock(): jest.Mocked<StockPort> {
  return {
    reserveStock: jest.fn(async () => true),
    releaseStock: jest.fn(async () => undefined)
  } as unknown as jest.Mocked<StockPort>;
}

describe("GetTransactionStatusUseCase", () => {
  it("throws NotFoundException when no transaction with that id exists", async () => {
    const repository = buildRepository();
    const provider = buildProvider(async () => ({ status: "APPROVED" }));
    const stock = buildStock();
    const useCase = new GetTransactionStatusUseCase(repository, provider, stock);

    await expect(useCase.execute("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns an already-terminal record unchanged, with no new provider call", async () => {
    const record = terminalRecord("txn_1", "succeeded");
    const repository = buildRepository(record);
    const provider = buildProvider(async () => ({ status: "APPROVED" }));
    const stock = buildStock();
    const useCase = new GetTransactionStatusUseCase(repository, provider, stock);

    const result = await useCase.execute("txn_1");

    expect(result).toEqual(record.result);
    expect(provider.pollTransaction).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.saveIfStatus).not.toHaveBeenCalled();
  });

  it("resolves a PENDING transaction to APPROVED: assigns delivery and persists APPROVED without releasing stock", async () => {
    const record = pendingRecord("txn_2");
    const repository = buildRepository(record);
    const provider = buildProvider(async () => ({ providerTransactionId: "provider_txn_2", status: "APPROVED", safeReason: "Approved" }));
    const stock = buildStock();
    const useCase = new GetTransactionStatusUseCase(repository, provider, stock);

    const result = await useCase.execute("txn_2");

    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") throw new Error("expected succeeded result");
    expect(result.deliveryAssignment).toMatchObject({ customerEmail: "ada@example.com" });
    expect(result.transaction?.status).toBe("APPROVED");
    expect(stock.releaseStock).not.toHaveBeenCalled();
    expect(repository.saveIfStatus).toHaveBeenCalledWith(expect.objectContaining({ result: expect.objectContaining({ status: "succeeded" }) }), "PENDING");
    await expect(repository.findById("txn_2")).resolves.toMatchObject({ result: { status: "succeeded" } });
  });

  it("resolves a PENDING transaction to DECLINED: releases stock and persists FAILED", async () => {
    const record = pendingRecord("txn_3");
    const repository = buildRepository(record);
    const provider = buildProvider(async () => ({ providerTransactionId: "provider_txn_3", status: "DECLINED", safeReason: "Card declined" }));
    const stock = buildStock();
    const useCase = new GetTransactionStatusUseCase(repository, provider, stock);

    const result = await useCase.execute("txn_3");

    expect(result.status).toBe("failed");
    if (result.status !== "failed") throw new Error("expected failed result");
    expect(result.reasonCode).toBe("payment_declined");
    expect(stock.releaseStock).toHaveBeenCalledWith(record.cartItems);
    await expect(repository.findById("txn_3")).resolves.toMatchObject({ result: { status: "failed" } });
  });

  it("returns PENDING unchanged with no repository write when the provider still reports PENDING", async () => {
    const record = pendingRecord("txn_4");
    const repository = buildRepository(record);
    const provider = buildProvider(async () => ({ providerTransactionId: "provider_txn_4", status: "PENDING", safeReason: "Still pending" }));
    const stock = buildStock();
    const useCase = new GetTransactionStatusUseCase(repository, provider, stock);

    const result = await useCase.execute("txn_4");

    expect(result.status).toBe("PENDING");
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.saveIfStatus).not.toHaveBeenCalled();
    expect(stock.releaseStock).not.toHaveBeenCalled();
  });

  it("stays PENDING with no repository write when the provider call itself fails transiently (not a provider-reported error)", async () => {
    const record = pendingRecord("txn_6");
    const repository = buildRepository(record);
    const provider = buildProvider(async () => {
      throw new Error("network blip");
    });
    const stock = buildStock();
    const useCase = new GetTransactionStatusUseCase(repository, provider, stock);

    const result = await useCase.execute("txn_6");

    expect(result.status).toBe("PENDING");
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.saveIfStatus).not.toHaveBeenCalled();
    expect(stock.releaseStock).not.toHaveBeenCalled();
  });

  it("returns the winner's already-committed record instead of double-applying side effects on a lost race", async () => {
    const record = pendingRecord("txn_5");
    const repository = buildRepository(record);
    const winnerRecord = terminalRecord("txn_5", "succeeded");
    repository.saveIfStatus.mockImplementation(async () => {
      // Simulate a concurrent call winning the race first.
      await repository.save(winnerRecord);
      return false;
    });
    const provider = buildProvider(async () => ({ providerTransactionId: "provider_txn_5", status: "DECLINED", safeReason: "Card declined" }));
    const stock = buildStock();
    const useCase = new GetTransactionStatusUseCase(repository, provider, stock);

    const result = await useCase.execute("txn_5");

    expect(result).toEqual(winnerRecord.result);
    expect(stock.releaseStock).not.toHaveBeenCalled();
  });
});
