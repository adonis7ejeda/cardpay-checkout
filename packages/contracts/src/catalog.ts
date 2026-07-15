export interface MoneyDto {
  amount: number;
  currency: "COP";
}

export interface CatalogItemDto {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  unitPrice: MoneyDto;
  stockAvailable: number;
  purchasable: boolean;
}
