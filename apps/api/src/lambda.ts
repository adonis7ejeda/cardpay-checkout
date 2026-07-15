import "reflect-metadata";
import configureServerlessExpress from "@codegenie/serverless-express";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Callback, Context, Handler } from "aws-lambda";
import { AppModule } from "./interface/app.module";

/**
 * AWS Lambda entrypoint that wraps the existing Nest/Express application with
 * `@codegenie/serverless-express`, for API Gateway + Lambda deployment (see
 * `infra/`). This file is intentionally separate from `src/main.ts`: local
 * dev (`pnpm start:dev`) keeps using the standalone Nest HTTP server exactly
 * as before, unaffected by this Lambda wrapper.
 */
type ServerlessExpressHandler = (event: APIGatewayProxyEvent, context: Context, callback: Callback<APIGatewayProxyResult>) => Promise<APIGatewayProxyResult>;

let cachedHandler: ServerlessExpressHandler | undefined;

async function bootstrapLambdaHandler(): Promise<ServerlessExpressHandler> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  const expressInstance = app.getHttpAdapter().getInstance();
  return configureServerlessExpress({ app: expressInstance }) as ServerlessExpressHandler;
}

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Callback<APIGatewayProxyResult>
) => {
  cachedHandler = cachedHandler ?? (await bootstrapLambdaHandler());
  return cachedHandler(event, context, callback);
};
