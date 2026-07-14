import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface DynamoDbClientConfig {
  region: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

/**
 * Resolves the plain DynamoDB client config object (pure, side-effect-free)
 * from environment variables:
 *
 * - `DYNAMODB_ENDPOINT` unset: no endpoint override. Real AWS DynamoDB is
 *   used with the SDK's normal credential chain (IAM role in Lambda, shared
 *   config/env locally).
 * - `DYNAMODB_ENDPOINT` set to a real AWS DynamoDB regional endpoint
 *   (`*.amazonaws.com`): endpoint is overridden but credentials are still
 *   left to the SDK's default chain -- never overridden with placeholders.
 * - `DYNAMODB_ENDPOINT` set to anything else (e.g. DynamoDB Local via Docker
 *   Compose, `http://localhost:8000`): non-secret placeholder credentials
 *   are supplied, since DynamoDB Local ignores credential values but the SDK
 *   still requires the shape to be present.
 */
export function resolveDynamoDbClientConfig(env: NodeJS.ProcessEnv = process.env): DynamoDbClientConfig {
  const endpoint = env.DYNAMODB_ENDPOINT;
  const region = env.AWS_REGION ?? "us-east-1";
  if (!endpoint) return { region };
  if (endpoint.includes(".amazonaws.com")) return { region, endpoint };
  return { region, endpoint, credentials: { accessKeyId: "dynamodb-local", secretAccessKey: "dynamodb-local" } };
}

export function createDynamoDbDocumentClient(env: NodeJS.ProcessEnv = process.env): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient(resolveDynamoDbClientConfig(env)));
}

export function transactionsTableName(env: NodeJS.ProcessEnv = process.env): string {
  return env.DYNAMODB_TRANSACTIONS_TABLE ?? "cardpay-transactions";
}

export function catalogStockTableName(env: NodeJS.ProcessEnv = process.env): string {
  return env.DYNAMODB_CATALOG_TABLE ?? "cardpay-catalog-stock";
}
