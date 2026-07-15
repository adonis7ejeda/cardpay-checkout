import type { CardBrand, FakeCardInputDto } from "@cardpay/contracts";

export interface CardValidationResult {
  valid: boolean;
  brand: CardBrand;
  errors: Partial<Record<keyof FakeCardInputDto, string>>;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const CARDHOLDER_NAME_PATTERN = /^[\p{L}\s'-]*$/u;

/** Strips characters other than letters, spaces, apostrophes, and hyphens as the user types. */
export function sanitizeCardholderName(value: string): string {
  return value.replace(/[^\p{L}\s'-]/gu, "");
}

export function detectCardBrand(number: string): CardBrand {
  const digits = onlyDigits(number);
  if (/^4\d{12}(\d{3})?$/.test(digits)) return "visa";
  if (/^(5[1-5]\d{14}|2(2[2-9]|[3-6]\d|7[01]|720)\d{12})$/.test(digits)) return "mastercard";
  return "unknown";
}

export function passesLuhn(number: string): boolean {
  const digits = onlyDigits(number);
  if (digits.length < 12) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function isFutureExpiration(month: string, year: string, today = new Date()): boolean {
  const monthNumber = Number(month);
  const yearNumber = Number(year.length === 2 ? `20${year}` : year);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber)) return false;
  const expiresAt = new Date(yearNumber, monthNumber, 0, 23, 59, 59, 999);
  return expiresAt >= today;
}

export function validateFakeCard(input: FakeCardInputDto, today = new Date()): CardValidationResult {
  const errors: CardValidationResult["errors"] = {};
  const brand = detectCardBrand(input.number);
  if (input.cardholderName.trim().length < 2) errors.cardholderName = "Cardholder name is required";
  else if (!CARDHOLDER_NAME_PATTERN.test(input.cardholderName)) errors.cardholderName = "Cardholder name can only contain letters and spaces";
  if (!/^[\d\s]*$/.test(input.number)) errors.number = "Card number can only contain digits";
  else if (brand === "unknown" || !passesLuhn(input.number)) errors.number = "Valid fake Visa or Mastercard number is required";
  if (!isFutureExpiration(input.expirationMonth, input.expirationYear, today)) errors.expirationMonth = "Valid future expiration is required";
  if (!/^\d{3,4}$/.test(input.cvc)) errors.cvc = "Valid CVC is required";
  return { valid: Object.keys(errors).length === 0, brand, errors };
}
