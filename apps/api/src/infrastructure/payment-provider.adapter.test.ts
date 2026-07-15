import { createHash } from "node:crypto";
import { EnvPaymentProviderAdapter } from "./payment-provider.adapter";

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
