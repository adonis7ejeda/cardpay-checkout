#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { CardpayCheckoutStack } from "../lib/cardpay-checkout-stack";

// Region defaults to us-east-1 (overridable via CDK_DEFAULT_REGION or
// `cdk deploy --context region=...`). Account is intentionally left to the
// CDK CLI's own environment resolution (CDK_DEFAULT_ACCOUNT, sourced from
// the caller's AWS credentials) -- never hardcoded to a specific account ID.
const app = new App();

new CardpayCheckoutStack(app, "CardpayCheckoutStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: (app.node.tryGetContext("region") as string | undefined) ?? process.env.CDK_DEFAULT_REGION ?? "us-east-1"
  }
});
