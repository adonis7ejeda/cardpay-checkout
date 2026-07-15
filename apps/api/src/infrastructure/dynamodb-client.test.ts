import { resolveDynamoDbClientConfig } from "./dynamodb-client";

describe("resolveDynamoDbClientConfig", () => {
  it("resolves a plain region config with no endpoint override when DYNAMODB_ENDPOINT is unset", () => {
    const config = resolveDynamoDbClientConfig({ AWS_REGION: "us-east-1" });

    expect(config).toEqual({ region: "us-east-1" });
  });

  it("defaults the region to us-east-1 when AWS_REGION is also unset", () => {
    const config = resolveDynamoDbClientConfig({});

    expect(config.region).toBe("us-east-1");
  });

  it("uses non-secret placeholder credentials for a local DynamoDB Local endpoint", () => {
    const config = resolveDynamoDbClientConfig({ DYNAMODB_ENDPOINT: "http://localhost:8000" });

    expect(config).toEqual({ region: "us-east-1", endpoint: "http://localhost:8000", credentials: { accessKeyId: "dynamodb-local", secretAccessKey: "dynamodb-local" } });
  });

  it("does not override credentials for a real AWS DynamoDB regional endpoint, letting the SDK default credential chain resolve them", () => {
    const config = resolveDynamoDbClientConfig({ DYNAMODB_ENDPOINT: "https://dynamodb.us-east-1.amazonaws.com" });

    expect(config).toEqual({ region: "us-east-1", endpoint: "https://dynamodb.us-east-1.amazonaws.com" });
    expect(config.credentials).toBeUndefined();
  });
});
