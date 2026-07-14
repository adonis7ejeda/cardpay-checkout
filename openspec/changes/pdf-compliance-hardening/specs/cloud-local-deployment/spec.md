# Cloud and Local Deployment Specification

## Purpose

Define credential-safe local and AWS deployment paths for the backend and persistence layer.

## Requirements

### Requirement: Local runtime parity

The backend MUST run locally without AWS credentials using in-memory repositories and fake provider behavior by default, SHOULD support DynamoDB Local through Docker or Compose when `DYNAMODB_ENDPOINT` is set, and MUST use real AWS DynamoDB only in AWS-configured environments.

#### Scenario: Default local startup

- GIVEN no AWS or provider secrets are configured
- WHEN the local backend starts
- THEN it MUST serve checkout APIs with in-memory state and fake provider behavior.

#### Scenario: Optional DynamoDB Local

- GIVEN Docker services are running and `DYNAMODB_ENDPOINT` is configured
- WHEN the backend starts locally
- THEN it SHOULD persist transactions, stock/catalog state, and delivery assignments in DynamoDB Local.

#### Scenario: Real provider remains opt-in

- GIVEN `PAYMENT_PROVIDER_PUBLIC_KEY`, `PAYMENT_PROVIDER_INTEGRITY_SECRET`, and `PAYMENT_PROVIDER_BASE_URL` are absent
- WHEN the backend starts locally
- THEN it MUST keep fake provider behavior and MUST NOT require raw secrets.

### Requirement: AWS serverless deployment

The cloud deployment MUST use AWS CDK TypeScript to define Lambda, API Gateway, and DynamoDB resources in `us-east-1` by default, with the Nest/Express application wrapped by `@codegenie/serverless-express`.

#### Scenario: CDK deployment configuration

- GIVEN deployment variables and secrets are provided through environment or secret management
- WHEN the CDK stack is synthesized or deployed
- THEN it MUST define API Gateway, Lambda, and DynamoDB resources without hardcoded credentials.

#### Scenario: Cloud persistence

- GIVEN the API is running in AWS
- WHEN checkout, catalog, stock, or delivery data changes
- THEN the service MUST persist the state in DynamoDB.

### Requirement: Secrets hygiene

Runtime configuration MUST be environment-driven and MUST NOT include raw provider credentials, API keys, or sponsor-branded values in source, docs, logs, tests, or committed artifacts.

#### Scenario: Configuration review

- GIVEN repository artifacts are scanned
- WHEN raw credentials or disallowed branding are detected
- THEN the delivery MUST fail verification.
