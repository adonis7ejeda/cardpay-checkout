import { createHash } from "node:crypto";
import { EnvPaymentProviderAdapter, InMemoryTransactionRepository } from "./adapters";
import type { TransactionRecord } from "./ports";

describe("EnvPaymentProviderAdapter", () => {
  const env = {
    PAYMENT_PROVIDER_PUBLIC_KEY: "pub_stagtest_example",
    PAYMENT_PROVIDER_INTEGRITY_SECRET: "test_integrity_example",
    PAYMENT_PROVIDER_BASE_URL: "https://api-sandbox.example.dev/v1"
  };

  const jsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ data: { id: "card_tok_1" } }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("sends the public key as a Bearer token on every request", async () => {
    const adapter = new EnvPaymentProviderAdapter(env);

    await adapter.tokenizeCard({ cardholderName: "Ada Lovelace", number: "4242424242424242", expirationMonth: "12", expirationYear: "2030", cvc: "123" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${env.PAYMENT_PROVIDER_PUBLIC_KEY}`);
  });

  it("normalizes expiration month and year to the two-digit format the provider requires", async () => {
    const adapter = new EnvPaymentProviderAdapter(env);

    await adapter.tokenizeCard({ cardholderName: "Ada Lovelace", number: "4242424242424242", expirationMonth: "6", expirationYear: "2029", cvc: "123" });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.exp_month).toBe("06");
    expect(body.exp_year).toBe("29");
  });

  it("leaves an already two-digit expiration month and year unchanged", async () => {
    const adapter = new EnvPaymentProviderAdapter(env);

    await adapter.tokenizeCard({ cardholderName: "Ada Lovelace", number: "4242424242424242", expirationMonth: "12", expirationYear: "30", cvc: "123" });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.exp_month).toBe("12");
    expect(body.exp_year).toBe("30");
  });

  it("rejects a malformed expiration month instead of sending a mangled value to the provider", async () => {
    const adapter = new EnvPaymentProviderAdapter(env);

    await expect(
      adapter.tokenizeCard({ cardholderName: "Ada Lovelace", number: "4242424242424242", expirationMonth: "13", expirationYear: "30", cvc: "123" })
    ).rejects.toThrow("Card expiration month must be between 01 and 12.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a malformed expiration year instead of silently truncating it", async () => {
    const adapter = new EnvPaymentProviderAdapter(env);

    await expect(
      adapter.tokenizeCard({ cardholderName: "Ada Lovelace", number: "4242424242424242", expirationMonth: "12", expirationYear: "10000", cvc: "123" })
    ).rejects.toThrow("Card expiration year must be 2 or 4 digits.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not let per-call headers override the Authorization bearer token", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ data: { presigned_acceptance: { acceptance_token: "accept_tok_1" }, presigned_personal_data_auth: { acceptance_token: "personal_auth_tok_1" } } })
    );
    const adapter = new EnvPaymentProviderAdapter(env);

    await adapter.fetchAcceptanceToken();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${env.PAYMENT_PROVIDER_PUBLIC_KEY}`);
  });

  it("fetches both the acceptance token and the personal data auth token", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ data: { presigned_acceptance: { acceptance_token: "accept_tok_1" }, presigned_personal_data_auth: { acceptance_token: "personal_auth_tok_1" } } })
    );
    const adapter = new EnvPaymentProviderAdapter(env);

    const result = await adapter.fetchAcceptanceToken();

    expect(result).toEqual({ acceptanceToken: "accept_tok_1", personalDataAuthToken: "personal_auth_tok_1" });
  });

  it("sends both acceptance tokens when creating a transaction", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: "provider_txn_1" } }));
    const adapter = new EnvPaymentProviderAdapter(env);

    await adapter.createTransaction({
      reference: "REF-1",
      amountInCents: 45000,
      currency: "COP",
      installments: 1,
      cardToken: "card_tok_1",
      acceptanceToken: "accept_tok_1",
      personalDataAuthToken: "personal_auth_tok_1",
      customerEmail: "ada@example.com"
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.acceptance_token).toBe("accept_tok_1");
    expect(body.accept_personal_auth).toBe("personal_auth_tok_1");
  });

  it("converts the domain's whole-peso amount to the provider's amount_in_cents, and signs the converted value", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: "provider_txn_1" } }));
    const adapter = new EnvPaymentProviderAdapter(env);

    await adapter.createTransaction({
      reference: "REF-1",
      amountInCents: 45000,
      currency: "COP",
      installments: 1,
      cardToken: "card_tok_1",
      acceptanceToken: "accept_tok_1",
      personalDataAuthToken: "personal_auth_tok_1",
      customerEmail: "ada@example.com"
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.amount_in_cents).toBe(4500000);
    const expectedSignature = createHash("sha256").update(`REF-14500000COP${env.PAYMENT_PROVIDER_INTEGRITY_SECRET}`).digest("hex");
    expect(body.signature).toBe(expectedSignature);
  });

  it("surfaces the provider's field-validation reasons without leaking submitted data", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { type: "INPUT_VALIDATION_ERROR", messages: { accept_personal_auth: ["is required"] } } }),
        { status: 422 }
      )
    );
    const adapter = new EnvPaymentProviderAdapter(env);

    await expect(
      adapter.createTransaction({
        reference: "REF-1",
        amountInCents: 45000,
        currency: "COP",
        installments: 1,
        cardToken: "card_tok_1",
        acceptanceToken: "accept_tok_1",
        personalDataAuthToken: "personal_auth_tok_1",
        customerEmail: "ada@example.com"
      })
    ).rejects.toThrow("INPUT_VALIDATION_ERROR - accept_personal_auth: is required");
  });
});

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
