import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDefined, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from "class-validator";

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

export class FakeCardRequestDto {
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
  @Type(() => FakeCardRequestDto)
  fakeCard!: FakeCardRequestDto;
}
