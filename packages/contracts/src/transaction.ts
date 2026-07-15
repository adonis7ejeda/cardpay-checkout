import type { CartItemDto, CartTotalsDto } from "./cart";

export type LocalTransactionStatus = "PENDING" | "APPROVED" | "FAILED" | "RETRYABLE";

export type ProviderTransactionStatus = "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";

export type TransactionStatus = "succeeded" | "failed" | LocalTransactionStatus;

export interface ProviderTransactionResultDto {
  providerTransactionId?: string;
  status: ProviderTransactionStatus;
  safeReason?: string;
}

export interface DeliveryAssignmentDto {
  deliveryId: string;
  status: "READY_FOR_DELIVERY";
  transactionId: string;
  reference: string;
  items: CartItemDto[];
  customerName: string;
  customerEmail: string;
  totals: CartTotalsDto;
  currency: "COP";
  createdAt: string;
  updatedAt: string;
}

export interface LocalTransactionDto {
  transactionId: string;
  transactionNumber: string;
  reference: string;
  status: LocalTransactionStatus;
  amountInCents: number;
  currency: "COP";
  installments: number;
  providerTransactionId?: string;
  safeReason?: string;
  deliveryAssignment?: DeliveryAssignmentDto;
}

interface TransactionResultBaseDto {
  transactionId: string;
  message: string;
}

export interface TransactionSucceededDto extends TransactionResultBaseDto {
  status: "succeeded";
  transaction?: LocalTransactionDto;
  deliveryAssignment?: DeliveryAssignmentDto;
}

export interface TransactionFailedDto extends TransactionResultBaseDto {
  status: "failed";
  reasonCode: "stock_unavailable" | "payment_declined" | "provider_error" | "validation_error";
  retryable: boolean;
  transaction?: LocalTransactionDto;
}

export interface TransactionPendingDto extends TransactionResultBaseDto {
  status: "PENDING";
  transaction: LocalTransactionDto;
}

export type TransactionResultDto = TransactionSucceededDto | TransactionFailedDto | TransactionPendingDto;
