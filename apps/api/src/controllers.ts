import { Body, Controller, Get, Post } from "@nestjs/common";
import type { CatalogItemDto, TransactionResultDto } from "@cardpay/contracts";
import { CreateTransactionDto } from "./dto";
import { CreateTransactionUseCase, GetCatalogUseCase } from "./use-cases";

@Controller()
export class CheckoutController {
  constructor(
    private readonly getCatalog: GetCatalogUseCase,
    private readonly createTransaction: CreateTransactionUseCase,
  ) {}

  @Get("catalog")
  catalog(): Promise<CatalogItemDto[]> {
    return this.getCatalog.execute();
  }

  @Post("transactions")
  transactions(@Body() body: CreateTransactionDto): Promise<TransactionResultDto> {
    return this.createTransaction.execute(body);
  }
}
