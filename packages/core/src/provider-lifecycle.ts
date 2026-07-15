import type { LocalTransactionStatus, ProviderTransactionStatus } from "@cardpay/contracts";

export function mapProviderStatus(status: ProviderTransactionStatus | "timeout"): LocalTransactionStatus {
  if (status === "APPROVED") return "APPROVED";
  if (status === "DECLINED" || status === "VOIDED") return "FAILED";
  if (status === "ERROR" || status === "timeout") return "RETRYABLE";
  return "PENDING";
}

export function sanitizeProviderReason(reason: unknown): string {
  const safe = typeof reason === "string" && reason.trim().length > 0 ? reason : "Provider response unavailable";
  return safe.replace(/\b\d(?:[ -]?\d){11,18}\b/g, "[redacted-card]").replace(/\bcvc\s*[:=]?\s*\d{3,4}\b/gi, "cvc [redacted]");
}

export function shouldApplyFulfillment(status: LocalTransactionStatus): boolean {
  return status === "APPROVED";
}
