import type { CartItemDto, TransactionFailedDto, TransactionResultDto, TransactionSucceededDto } from "@cardpay/contracts";

export function shouldClearCart(result: TransactionResultDto): boolean {
  return result.status === "succeeded";
}

export function nextCartAfterOutcome(result: TransactionResultDto, currentCart: CartItemDto[]): CartItemDto[] {
  return shouldClearCart(result) ? [] : currentCart;
}

export function succeeded(transactionId: string): TransactionSucceededDto {
  return { status: "succeeded", transactionId, message: "Payment approved" };
}

export function failed(
  transactionId: string,
  reasonCode: TransactionFailedDto["reasonCode"],
  retryable: boolean
): TransactionFailedDto {
  return { status: "failed", transactionId, reasonCode, retryable, message: "Payment could not be completed" };
}
