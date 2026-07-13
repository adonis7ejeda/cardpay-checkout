import type { CheckoutIdentityDto } from "@cardpay/contracts";

export interface IdentityValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof CheckoutIdentityDto, string>>;
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
  if (!isValidEmail(identity.email.trim())) errors.email = "Valid email is required";
  return { valid: Object.keys(errors).length === 0, errors };
}
