import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDefined, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsString, Min, Validate, ValidateNested, ValidatorConstraint } from "class-validator";
import type { ValidatorConstraintInterface } from "class-validator";
import { validateFakeCard } from "@cardpay/core";

export class MoneyRequestDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(["COP"])
  currency!: "COP";
}

export class CartItemRequestDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => MoneyRequestDto)
  unitPrice!: MoneyRequestDto;
}

export class CartTotalsRequestDto {
  @ValidateNested()
  @Type(() => MoneyRequestDto)
  subtotal!: MoneyRequestDto;

  @ValidateNested()
  @Type(() => MoneyRequestDto)
  total!: MoneyRequestDto;

  @IsInt()
  @Min(1)
  itemCount!: number;
}

export class IdentityRequestDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  email!: string;
}

export class CardRequestDto {
  @IsString()
  @IsNotEmpty()
  cardholderName!: string;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsString()
  @IsNotEmpty()
  expirationMonth!: string;

  @IsString()
  @IsNotEmpty()
  expirationYear!: string;

  @IsString()
  @IsNotEmpty()
  cvc!: string;
}

@ValidatorConstraint({ name: "isValidFakeCard", async: false })
class ValidFakeCardConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const input = value as CardRequestDto;
    if (!hasRequiredCardFields(input)) return false;
    return validateFakeCard(input).valid;
  }
}

function hasRequiredCardFields(input: Partial<CardRequestDto>): input is CardRequestDto {
  return [input.cardholderName, input.number, input.expirationMonth, input.expirationYear, input.cvc].every((value) => typeof value === "string");
}

export class CreateTransactionDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => IdentityRequestDto)
  identity!: IdentityRequestDto;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemRequestDto)
  cartItems!: CartItemRequestDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => CartTotalsRequestDto)
  totals!: CartTotalsRequestDto;

  @IsDefined()
  @ValidateNested()
  @Validate(ValidFakeCardConstraint, { message: "Valid Visa or Mastercard card data is required" })
  @Type(() => CardRequestDto)
  card!: CardRequestDto;

  @IsInt()
  @Min(1)
  installments!: number;
}
