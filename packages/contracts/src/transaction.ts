export type TransactionStatus = "succeeded" | "failed";

interface TransactionResultBaseDto {
  transactionId: string;
  message: string;
}

export interface TransactionSucceededDto extends TransactionResultBaseDto {
  status: "succeeded";
}

export interface TransactionFailedDto extends TransactionResultBaseDto {
  status: "failed";
  reasonCode: "stock_unavailable" | "payment_declined" | "provider_error" | "validation_error";
  retryable: boolean;
}

export type TransactionResultDto = TransactionSucceededDto | TransactionFailedDto;
