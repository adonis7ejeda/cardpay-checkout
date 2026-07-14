import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { CatalogItemDto, TransactionResultDto } from "@cardpay/contracts";
import { CreateTransactionDto } from "./dto";
import { CreateTransactionUseCase, GetCatalogUseCase, GetTransactionStatusUseCase } from "./use-cases";

@Controller()
export class CheckoutController {
  constructor(
    private readonly getCatalog: GetCatalogUseCase,
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly getTransactionStatus: GetTransactionStatusUseCase,
  ) {}

  @Get("catalog")
  catalog(): Promise<CatalogItemDto[]> {
    return this.getCatalog.execute();
  }

  @Post("transactions")
  transactions(@Body() body: CreateTransactionDto): Promise<TransactionResultDto> {
    return this.createTransaction.execute(body);
  }

  @Get("transactions/:transactionId")
  getTransactionStatusById(@Param("transactionId") transactionId: string): Promise<TransactionResultDto> {
    return this.getTransactionStatus.execute(transactionId);
  }
}
