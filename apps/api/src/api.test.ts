import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import type { PaymentAttemptDto } from "@cardpay/contracts";
import request from "supertest";
import { AppModule } from "./interface/app.module";
import { createDefaultPaymentProvider, DeterministicFakePaymentAdapter, EnvPaymentProviderAdapter, InMemoryCatalogAdapter, InMemoryTransactionRepository } from "./infrastructure/adapters";
import { PAYMENT_PROVIDER_PORT } from "./application/tokens";
import { CreateTransactionUseCase } from "./application/use-cases";

const attempt = (cardNumber = "4111111111111111"): PaymentAttemptDto => ({
  identity: { fullName: "Ada Lovelace", email: "ada@example.com" },
  cartItems: [{ productId: "basic-tee", quantity: 1, unitPrice: { amount: 45000, currency: "COP" } }],
  totals: { subtotal: { amount: 45000, currency: "COP" }, total: { amount: 45000, currency: "COP" }, itemCount: 1 },
  installments: 1,
  card: { cardholderName: "Ada Lovelace", number: cardNumber, expirationMonth: "12", expirationYear: "2030", cvc: "123" },
});

describe("checkout API", () => {
  let app: INestApplication;
  let catalog: InMemoryCatalogAdapter;
  let repo: InMemoryTransactionRepository;
  let provider: DeterministicFakePaymentAdapter;
  let createTransaction: CreateTransactionUseCase;

  beforeEach(async () => {
    delete process.env.PAYMENT_PROVIDER_PUBLIC_KEY;
    delete process.env.PAYMENT_PROVIDER_INTEGRITY_SECRET;
    delete process.env.PAYMENT_PROVIDER_BASE_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    catalog = moduleRef.get(InMemoryCatalogAdapter);
    repo = moduleRef.get(InMemoryTransactionRepository);
    provider = moduleRef.get(PAYMENT_PROVIDER_PORT);
    createTransaction = moduleRef.get(CreateTransactionUseCase);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns backend-owned catalog items with purchasability data", async () => {
    const response = await request(app.getHttpServer()).get("/catalog").expect(200);

    expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: "basic-tee", purchasable: true, stockAvailable: 4 })]));
  });

  it("marks out-of-stock catalog items as not purchasable", async () => {
    catalog.setStock("basic-tee", 0);

    const response = await request(app.getHttpServer()).get("/catalog").expect(200);

    expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: "basic-tee", purchasable: false, stockAvailable: 0 })]));
  });

  it("rejects unavailable stock without creating delivery assignment", async () => {
    catalog.setStock("basic-tee", 0);

    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "stock_unavailable", retryable: false });
    expect(response.body.deliveryAssignment).toBeUndefined();
  });

  it("rejects unknown products as unavailable stock", async () => {
    const response = await request(app.getHttpServer())
      .post("/transactions")
      .send({ ...attempt(), cartItems: [{ ...attempt().cartItems[0], productId: "missing-product" }] })
      .expect(201);

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "stock_unavailable" });
  });

  it("rejects client-supplied totals that do not match the backend catalog", async () => {
    const response = await request(app.getHttpServer())
      .post("/transactions")
      .send({ ...attempt(), totals: { subtotal: { amount: 1, currency: "COP" }, total: { amount: 1, currency: "COP" }, itemCount: 1 } })
      .expect(201);

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "validation_error", retryable: false });
    expect(response.body.deliveryAssignment).toBeUndefined();
  });

  it("persists successful transaction outcomes", async () => {
    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);
    const records = await repo.all();

    expect(response.body).toMatchObject({ status: "succeeded", message: "The payment was approved." });
    expect(response.body.transaction).toMatchObject({ status: "APPROVED", reference: expect.stringMatching(/^REF-/), installments: 1 });
    expect(response.body.deliveryAssignment).toMatchObject({ customerEmail: "ada@example.com", currency: "COP" });
    expect(records).toHaveLength(1);
    expect(records[0]?.result.status).toBe("succeeded");
  });

  it("persists failed provider outcomes with safe reasons and no raw card data", async () => {
    const response = await request(app.getHttpServer()).post("/transactions").send(attempt("4000000000020000")).expect(201);
    const records = await repo.all();

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "payment_declined", retryable: false });
    expect(JSON.stringify(records)).not.toContain("4000000000020000");
    expect(JSON.stringify(records)).not.toContain("123");
  });

  it("continues polling pending provider results before resolving approval", async () => {
    const poll = jest.spyOn(provider, "pollTransaction");
    poll.mockResolvedValueOnce({ providerTransactionId: "provider_pending", status: "PENDING", safeReason: "Still pending" });
    poll.mockResolvedValueOnce({ providerTransactionId: "provider_pending", status: "APPROVED", safeReason: "Approved" });

    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(poll).toHaveBeenCalledTimes(2);
    expect(response.body).toMatchObject({ status: "succeeded" });
  });

  it("returns pending provider semantics and keeps reserved stock when polling remains pending", async () => {
    jest.spyOn(provider, "pollTransaction").mockResolvedValue({ providerTransactionId: "provider_pending", status: "PENDING", safeReason: "Still pending" });

    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(response.body).toMatchObject({ status: "PENDING", message: "The payment is still pending confirmation." });
    expect(response.body.transaction).toMatchObject({ status: "PENDING" });
    await expect(request(app.getHttpServer()).get("/catalog")).resolves.toMatchObject({ body: expect.arrayContaining([expect.objectContaining({ id: "basic-tee", stockAvailable: 3 })]) });
  });

  it("reconciles a PENDING transaction to succeeded via GET /transactions/:transactionId", async () => {
    const poll = jest.spyOn(provider, "pollTransaction");
    // Exhausts all MAX_PROVIDER_POLLS attempts during creation so the POST
    // response itself comes back PENDING, matching the "returns pending
    // provider semantics" test above.
    poll.mockResolvedValue({ providerTransactionId: "provider_pending", status: "PENDING", safeReason: "Still pending" });

    const created = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);
    expect(created.body).toMatchObject({ status: "PENDING" });
    const transactionId = created.body.transactionId as string;

    poll.mockResolvedValueOnce({ providerTransactionId: "provider_pending", status: "APPROVED", safeReason: "Approved" });
    const reconciled = await request(app.getHttpServer()).get(`/transactions/${transactionId}`).expect(200);

    expect(reconciled.body).toMatchObject({ status: "succeeded" });
    expect(reconciled.body.deliveryAssignment).toBeDefined();
  });

  it("returns 404 from GET /transactions/:transactionId for an unknown id", async () => {
    await request(app.getHttpServer()).get("/transactions/txn_does_not_exist").expect(404);
  });

  it("does not oversell stock when approved transactions race for the last unit", async () => {
    catalog.setStock("basic-tee", 1);

    const first = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);
    const second = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(first.body).toMatchObject({ status: "succeeded" });
    expect(first.body.deliveryAssignment).toBeDefined();
    expect(second.body).toMatchObject({ status: "failed", reasonCode: "stock_unavailable", retryable: false });
    expect(second.body.transaction).toMatchObject({ status: "FAILED", safeReason: "One or more items are no longer available." });
    expect(second.body.deliveryAssignment).toBeUndefined();
    await expect(request(app.getHttpServer()).get("/catalog")).resolves.toMatchObject({ body: expect.arrayContaining([expect.objectContaining({ id: "basic-tee", stockAvailable: 0 })]) });
  });

  it("does not call the provider after stock becomes unavailable", async () => {
    catalog.setStock("basic-tee", 0);
    const createProviderTransaction = jest.spyOn(provider, "createTransaction");

    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "stock_unavailable" });
    expect(createProviderTransaction).not.toHaveBeenCalled();
  });

  it("converts provider errors into safe retryable failures", async () => {
    jest.spyOn(provider, "createTransaction").mockRejectedValueOnce(new Error("provider exploded"));

    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "provider_error", retryable: true });
    expect(response.body.message).not.toContain("exploded");
    await expect(request(app.getHttpServer()).get("/catalog")).resolves.toMatchObject({ body: expect.arrayContaining([expect.objectContaining({ id: "basic-tee", stockAvailable: 4 })]) });
  });

  it("returns deterministic fake provider results for identical payment input", async () => {
    const first = await provider.authorize(attempt());
    const second = await provider.authorize(attempt());

    expect(first).toEqual(second);
    expect(first.transactionId).toMatch(/^fake_/);
  });

  it("fails invalid request payloads before checkout orchestration", async () => {
    const response = await request(app.getHttpServer()).post("/transactions").send({ ...attempt(), identity: { fullName: "Ada", email: "bad-email" } }).expect(400);

    expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining("email must be an email")]));
  });

  it("rejects invalid fake card data before checkout orchestration", async () => {
    const execute = jest.spyOn(createTransaction, "execute");
    const authorize = jest.spyOn(provider, "authorize");

    await request(app.getHttpServer()).post("/transactions").send(attempt("0000")).expect(400);

    expect(execute).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  it("rejects incomplete fake card data before checkout orchestration", async () => {
    const payload = attempt();
    const execute = jest.spyOn(createTransaction, "execute");
    const authorize = jest.spyOn(provider, "authorize");
    delete (payload.card as Partial<typeof payload.card>).number;

    await request(app.getHttpServer()).post("/transactions").send(payload).expect(400);

    expect(execute).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  it.each(["identity", "cartItems", "totals", "card"] as const)("rejects missing %s before checkout orchestration", async (section) => {
    const payload: Partial<PaymentAttemptDto> = { ...attempt() };
    delete payload[section];
    const execute = jest.spyOn(createTransaction, "execute");
    const authorize = jest.spyOn(provider, "authorize");

    await request(app.getHttpServer()).post("/transactions").send(payload).expect(400);

    expect(execute).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  it("rejects missing cart item unit price before checkout orchestration", async () => {
    const payload = { ...attempt(), cartItems: [{ productId: "basic-tee", quantity: 1 }] };
    const execute = jest.spyOn(createTransaction, "execute");
    const authorize = jest.spyOn(provider, "authorize");

    await request(app.getHttpServer()).post("/transactions").send(payload).expect(400);

    expect(execute).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });
});

describe("payment provider wiring", () => {
  afterEach(() => {
    delete process.env.PAYMENT_PROVIDER_PUBLIC_KEY;
    delete process.env.PAYMENT_PROVIDER_INTEGRITY_SECRET;
    delete process.env.PAYMENT_PROVIDER_BASE_URL;
  });

  it("uses the deterministic fake provider without env config", () => {
    expect(createDefaultPaymentProvider({})).toBeInstanceOf(DeterministicFakePaymentAdapter);
  });

  it("uses the env-driven provider when all provider env placeholders are configured", () => {
    expect(
      createDefaultPaymentProvider({
        PAYMENT_PROVIDER_PUBLIC_KEY: "public_key_placeholder",
        PAYMENT_PROVIDER_INTEGRITY_SECRET: "integrity_secret_placeholder",
        PAYMENT_PROVIDER_BASE_URL: "https://provider.example.test"
      })
    ).toBeInstanceOf(EnvPaymentProviderAdapter);
  });

  it("fails fast when provider env config is partial", () => {
    expect(() => createDefaultPaymentProvider({ PAYMENT_PROVIDER_PUBLIC_KEY: "public_key_placeholder" })).toThrow("Payment provider environment configuration is incomplete.");
  });

  it("fails fast instead of using the fake provider when running in production without env config", () => {
    expect(() => createDefaultPaymentProvider({ NODE_ENV: "production" })).toThrow("Payment provider environment configuration is missing in production.");
  });

  it("wires AppModule through the default provider factory", async () => {
    process.env.PAYMENT_PROVIDER_PUBLIC_KEY = "public_key_placeholder";
    process.env.PAYMENT_PROVIDER_INTEGRITY_SECRET = "integrity_secret_placeholder";
    process.env.PAYMENT_PROVIDER_BASE_URL = "https://provider.example.test";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(PAYMENT_PROVIDER_PORT)).toBeInstanceOf(EnvPaymentProviderAdapter);

    await moduleRef.close();
  });
});
