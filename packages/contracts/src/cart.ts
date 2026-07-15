import type { MoneyDto } from "./catalog";

export interface CartItemDto {
  productId: string;
  quantity: number;
  unitPrice: MoneyDto;
}

export interface CartTotalsDto {
  subtotal: MoneyDto;
  total: MoneyDto;
  itemCount: number;
}

export interface CartDto {
  items: CartItemDto[];
  totals: CartTotalsDto;
}
