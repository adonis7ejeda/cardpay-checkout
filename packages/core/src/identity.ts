import type { CheckoutIdentityDto } from "@cardpay/contracts";

export interface IdentityValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof CheckoutIdentityDto, string>>;
}

const FULL_NAME_PATTERN = /^[\p{L}\s'-]*$/u;

/** Strips characters other than letters, spaces, apostrophes, and hyphens as the user types. */
export function sanitizeFullName(value: string): string {
  return value.replace(/[^\p{L}\s'-]/gu, "");
}

function isValidEmail(value: string): boolean {
  if (value.length === 0) return false;

  for (const char of value) {
    if (char === "@") continue;
    if (char.trim().length === 0) return false;
  }

  const parts = value.split("@");
  if (parts.length !== 2) return false;

  const [localPart, domain] = parts;
  const dotIndex = domain.indexOf(".");

  return localPart.length > 0 && dotIndex > 0 && dotIndex < domain.length - 1;
}

export function validateIdentity(identity: CheckoutIdentityDto): IdentityValidationResult {
  const errors: IdentityValidationResult["errors"] = {};
  if (identity.fullName.trim().length < 2) errors.fullName = "Full name is required";
  else if (!FULL_NAME_PATTERN.test(identity.fullName)) errors.fullName = "Full name can only contain letters and spaces";
  if (!isValidEmail(identity.email.trim())) errors.email = "Valid email is required";
  return { valid: Object.keys(errors).length === 0, errors };
}
