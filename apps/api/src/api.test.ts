import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "./app.module";
import { DeterministicFakePaymentAdapter, InMemoryCatalogAdapter, InMemoryTransactionRepository } from "./adapters";
import { PAYMENT_PROVIDER_PORT } from "./tokens";
import { CreateTransactionUseCase } from "./use-cases";

const attempt = (cardNumber = "4111111111111111") => ({
  identity: { fullName: "Ada Lovelace", email: "ada@example.com" },
  cartItems: [{ productId: "basic-tee", quantity: 1, unitPrice: { amount: 45000, currency: "COP" } }],
  totals: { subtotal: { amount: 45000, currency: "COP" }, total: { amount: 45000, currency: "COP" }, itemCount: 1 },
  fakeCard: { cardholderName: "Ada Lovelace", number: cardNumber, expirationMonth: "12", expirationYear: "2030", cvc: "123" },
});

describe("checkout API", () => {
  let app: INestApplication;
  let catalog: InMemoryCatalogAdapter;
  let repo: InMemoryTransactionRepository;
  let provider: DeterministicFakePaymentAdapter;
  let createTransaction: CreateTransactionUseCase;

  beforeEach(async () => {
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

  it("rejects unavailable stock before provider authorization", async () => {
    catalog.setStock("basic-tee", 0);
    const authorize = jest.spyOn(provider, "authorize");

    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(authorize).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({ status: "failed", reasonCode: "stock_unavailable", retryable: false });
  });

  it("rejects unknown products as unavailable stock", async () => {
    const response = await request(app.getHttpServer())
      .post("/transactions")
      .send({ ...attempt(), cartItems: [{ ...attempt().cartItems[0], productId: "missing-product" }] })
      .expect(201);

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "stock_unavailable" });
  });

  it("persists successful transaction outcomes", async () => {
    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);
    const records = await repo.all();

    expect(response.body).toMatchObject({ status: "succeeded", message: "The payment was approved." });
    expect(records).toHaveLength(1);
    expect(records[0]?.result.status).toBe("succeeded");
  });

  it("persists failed provider outcomes with safe reasons and no raw card data", async () => {
    const response = await request(app.getHttpServer()).post("/transactions").send(attempt("4000000000000000")).expect(201);
    const records = await repo.all();

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "payment_declined", retryable: true });
    expect(JSON.stringify(records)).not.toContain("4000000000000000");
    expect(JSON.stringify(records)).not.toContain("123");
  });

  it("converts provider errors into safe retryable failures", async () => {
    jest.spyOn(provider, "authorize").mockRejectedValueOnce(new Error("provider exploded"));

    const response = await request(app.getHttpServer()).post("/transactions").send(attempt()).expect(201);

    expect(response.body).toMatchObject({ status: "failed", reasonCode: "provider_error", retryable: true });
    expect(response.body.message).not.toContain("exploded");
  });

  it("returns deterministic fake provider results for identical payment input", async () => {
    const first = await provider.authorize(attempt());
    const second = await provider.authorize(attempt());

    expect(first).toEqual(second);
    expect(first.transactionId).toMatch(/^fake_/);
  });

  it("fails invalid request payloads before checkout orchestration", async () => {
    await request(app.getHttpServer()).post("/transactions").send({ ...attempt(), identity: { fullName: "Ada", email: "bad-email" } }).expect(400);
  });

  it.each(["identity", "cartItems", "totals", "fakeCard"] as const)("rejects missing %s before checkout orchestration", async (section) => {
    const payload = attempt();
    delete (payload as Record<string, unknown>)[section];
    const execute = jest.spyOn(createTransaction, "execute");
    const authorize = jest.spyOn(provider, "authorize");

    await request(app.getHttpServer()).post("/transactions").send(payload).expect(400);

    expect(execute).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });
});
