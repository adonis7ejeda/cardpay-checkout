import * as path from "node:path";
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

/**
 * CardPay checkout API deployment stack: API Gateway -> Lambda -> DynamoDB.
 *
 * No account ID or credentials are hardcoded anywhere in this stack. The
 * account/region come from the CDK environment resolved in `bin/`
 * (CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION, defaulting region to us-east-1),
 * and payment provider secrets are intentionally NEVER wired here — they must
 * be supplied through deployment-time environment/secret management outside
 * this repository, matching the local "fake provider by default" contract.
 */
export class CardpayCheckoutStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const transactionsTable = new Table(this, "TransactionsTable", {
      tableName: (this.node.tryGetContext("transactionsTableName") as string | undefined) ?? "cardpay-transactions",
      partitionKey: { name: "transactionId", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });

    const catalogStockTable = new Table(this, "CatalogStockTable", {
      tableName: (this.node.tryGetContext("catalogTableName") as string | undefined) ?? "cardpay-catalog-stock",
      partitionKey: { name: "productId", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });

    // Provisioned for delivery assignment persistence per the deployment
    // spec. The current API (`apps/api/src/adapters.ts` /
    // `dynamodb-adapters.ts`) still stores each delivery assignment nested
    // inside its transaction record via `TransactionRepositoryPort`, not
    // through a standalone delivery port/table yet -- see apply-progress
    // risks for this documented gap rather than silently redesigning PR1's
    // ports.
    const deliveryTable = new Table(this, "DeliveryAssignmentsTable", {
      tableName: (this.node.tryGetContext("deliveryTableName") as string | undefined) ?? "cardpay-delivery-assignments",
      partitionKey: { name: "deliveryId", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });

    // NodejsFunction bundles apps/api/src/lambda.ts and its dependencies
    // (via esbuild, run locally at synth/deploy time) into a single
    // self-contained asset -- unlike a plain `Function` + `Code.fromAsset`
    // pointed at `dist`, this actually packages node_modules (nestjs,
    // serverless-express, aws-sdk, etc.), so the deployed function has
    // everything it needs to run.
    const apiFunction = new NodejsFunction(this, "CheckoutApiFunction", {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "..", "..", "apps", "api", "src", "lambda.ts"),
      handler: "handler",
      timeout: Duration.seconds(15),
      memorySize: 512,
      bundling: {
        // NestJS's DI container references some optional peer packages
        // (microservices/websockets transports, cache-manager) dynamically;
        // this app never installs or uses them, so esbuild must be told not
        // to try to resolve/bundle them rather than failing the build.
        externalModules: ["@nestjs/microservices", "@nestjs/websockets", "cache-manager"],
        sourceMap: true
      },
      environment: {
        NODE_ENV: "production",
        // Real AWS DynamoDB's public regional endpoint (not a secret, not
        // DynamoDB Local) -- same client/adapter code path as local dev,
        // just pointed at AWS instead of a Docker container. `AWS_REGION` is
        // a Lambda-reserved env var the runtime sets automatically, so it is
        // intentionally not set here.
        DYNAMODB_ENDPOINT: `https://dynamodb.${this.region}.amazonaws.com`,
        DYNAMODB_TRANSACTIONS_TABLE: transactionsTable.tableName,
        DYNAMODB_CATALOG_TABLE: catalogStockTable.tableName,
        DYNAMODB_DELIVERY_TABLE: deliveryTable.tableName
        // PAYMENT_PROVIDER_PUBLIC_KEY / PAYMENT_PROVIDER_INTEGRITY_SECRET /
        // PAYMENT_PROVIDER_BASE_URL are intentionally NOT set here. With
        // NODE_ENV=production and no payment provider config, the app's
        // production guard (apps/api/src/adapters.ts) refuses to start
        // rather than silently using the fake provider -- wiring the real
        // provider is an explicit, separate secret-management step the
        // operator must complete after deploying this stack.
      }
    });

    transactionsTable.grantReadWriteData(apiFunction);
    catalogStockTable.grantReadWriteData(apiFunction);
    deliveryTable.grantReadWriteData(apiFunction);

    const api = new RestApi(this, "CheckoutRestApi", { restApiName: "cardpay-checkout-api" });
    api.root.addProxy({ defaultIntegration: new LambdaIntegration(apiFunction), anyMethod: true });
  }
}
