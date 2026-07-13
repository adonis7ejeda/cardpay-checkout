import type { CartItemDto, CartTotalsDto } from "./cart";
import type { CheckoutIdentityDto } from "./identity";

export type CardBrand = "visa" | "mastercard" | "unknown";

export interface FakeCardInputDto {
  cardholderName: string;
  number: string;
  expirationMonth: string;
  expirationYear: string;
  cvc: string;
}

export interface PaymentAttemptDto {
  identity: CheckoutIdentityDto;
  cartItems: CartItemDto[];
  totals: CartTotalsDto;
  fakeCard: FakeCardInputDto;
}
