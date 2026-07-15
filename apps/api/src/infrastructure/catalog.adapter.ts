import type { CartItemDto, CatalogItemDto } from "@cardpay/contracts";
import { CATALOG_SEED } from "./catalog-data";
import type { CatalogPort, StockPort } from "../application/ports";

const products: CatalogItemDto[] = CATALOG_SEED;

export class InMemoryCatalogAdapter implements CatalogPort, StockPort {
  private readonly stock = new Map(products.map((item) => [item.id, item.stockAvailable]));

  async list(): Promise<CatalogItemDto[]> {
    return products.map((item) => {
      const stockAvailable = this.stock.get(item.id) ?? 0;
      return { ...item, stockAvailable, purchasable: stockAvailable > 0 };
    });
  }

  async reserveStock(items: CartItemDto[]): Promise<boolean> {
    const available = items.every((item) => {
      const stockAvailable = this.stock.get(item.productId);
      return stockAvailable !== undefined && item.quantity <= stockAvailable;
    });
    if (!available) return false;
    for (const item of items) this.stock.set(item.productId, (this.stock.get(item.productId) ?? item.quantity) - item.quantity);
    return true;
  }

  async releaseStock(items: CartItemDto[]): Promise<void> {
    for (const item of items) this.stock.set(item.productId, (this.stock.get(item.productId) ?? 0) + item.quantity);
  }

  setStock(productId: string, quantity: number): void {
    this.stock.set(productId, quantity);
  }
}
