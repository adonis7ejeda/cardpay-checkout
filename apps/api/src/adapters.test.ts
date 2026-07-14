import { EnvPaymentProviderAdapter } from "./adapters";

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

  it("does not let per-call headers override the Authorization bearer token", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { presigned_acceptance: { acceptance_token: "accept_tok_1" } } }));
    const adapter = new EnvPaymentProviderAdapter(env);

    await adapter.fetchAcceptanceToken();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${env.PAYMENT_PROVIDER_PUBLIC_KEY}`);
  });
});
