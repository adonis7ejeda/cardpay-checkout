import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

const REPO_ROOT = path.join(__dirname, "..", "..");

/**
 * The Lambda's entry is the tsc-COMPILED lambda.js, not the raw .ts source
 * (see the comment on `apiFunction` below for why). That means whichever
 * command triggers a synth/deploy -- `cdk synth`, `cdk deploy`, `npx cdk
 * deploy`, `pnpm --filter infra cdk deploy` -- must always rebuild
 * contracts -> core -> api first, or a stale/missing bundle could be
 * silently packaged and deployed. `infra/package.json`'s `presynth` npm
 * lifecycle hook only fires for the literal `pnpm run synth` invocation,
 * not for `cdk` invoked directly, so the build is triggered here instead,
 * synchronously, as the very first thing this stack does -- guaranteeing
 * freshness regardless of how synth/deploy was invoked.
 */
function buildLambdaDependencies(): void {
  const filters = ["@cardpay/contracts", "@cardpay/core", "@cardpay/api"];
  for (const filter of filters) {
    execFileSync("pnpm", ["--filter", filter, "build"], { cwd: REPO_ROOT, stdio: "inherit", shell: true });
  }
}

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

    buildLambdaDependencies();

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
    // spec. The current API (`apps/api/src/infrastructure/adapters.ts` /
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

    // NodejsFunction bundles the ALREADY tsc-COMPILED lambda.js (not the raw
    // .ts source) and its dependencies via esbuild, into a single
    // self-contained asset -- unlike a plain `Function` + `Code.fromAsset`
    // pointed at `dist`, this actually packages node_modules (nestjs,
    // serverless-express, aws-sdk, etc.), so the deployed function has
    // everything it needs to run.
    //
    // Entry MUST be the compiled .js, not the .ts source: esbuild does not
    // implement TypeScript's `emitDecoratorMetadata`
    // (https://github.com/aws/aws-cdk/issues/13767), which NestJS's
    // constructor-based dependency injection relies on for every
    // `@Injectable()` class with no explicit `@Inject()` token. Bundling the
    // raw .ts source silently strips that metadata -- Nest still boots
    // without error, but every such injected dependency resolves to
    // `undefined` at request time (caught in production via CloudWatch
    // logs: "Cannot read properties of undefined (reading 'execute')").
    // tsc already emits the metadata correctly (see apps/api/tsconfig.json's
    // experimentalDecorators/emitDecoratorMetadata); esbuild only needs to
    // bundle the resulting plain JS, not re-understand the decorators.
    const apiFunction = new NodejsFunction(this, "CheckoutApiFunction", {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "..", "..", "apps", "api", "dist", "apps", "api", "src", "lambda.js"),
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
        // production guard (apps/api/src/infrastructure/adapters.ts) refuses to start
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
