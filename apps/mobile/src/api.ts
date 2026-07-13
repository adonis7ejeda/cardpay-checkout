import type { CatalogItemDto, PaymentAttemptDto, TransactionResultDto } from "@cardpay/contracts";
import type { ApiClient } from "./types";

export class HttpApiClient implements ApiClient {
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

  async fetchCatalog(): Promise<CatalogItemDto[]> {
    const response = await this.fetcher(`${this.baseUrl}/catalog`);
    if (!response.ok) throw new Error("Catalog is unavailable");
    return (await response.json()) as CatalogItemDto[];
  }

  async submitPayment(input: PaymentAttemptDto): Promise<TransactionResultDto> {
    const response = await this.fetcher(`${this.baseUrl}/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error("Payment submission is unavailable");
    return (await response.json()) as TransactionResultDto;
  }
}
