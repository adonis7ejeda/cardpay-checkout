import type { CatalogItemDto } from "@cardpay/contracts";

export const CATALOG_SEED: CatalogItemDto[] = [
  { id: "basic-tee", name: "Basic Tee", description: "Everyday cotton tee", unitPrice: { amount: 45000, currency: "COP" }, stockAvailable: 4, purchasable: true },
  { id: "canvas-tote", name: "Canvas Tote", description: "Reusable checkout tote", unitPrice: { amount: 32000, currency: "COP" }, stockAvailable: 2, purchasable: true },
];
