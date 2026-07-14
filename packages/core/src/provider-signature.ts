import { createHash } from "node:crypto";

/** Server-only: signs provider requests. Never import this from the mobile bundle (needs Node's crypto). */
export function createProviderSignature(reference: string, amountInCents: number, currency: "COP", integritySecret: string): string {
  return createHash("sha256").update(`${reference}${amountInCents}${currency}${integritySecret}`).digest("hex");
}
