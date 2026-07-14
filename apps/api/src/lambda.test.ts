import type { APIGatewayProxyEvent, Context } from "aws-lambda";

const configureMock: jest.Mock = jest.fn(() => jest.fn().mockResolvedValue({ statusCode: 200, body: "ok" }));

jest.mock("@codegenie/serverless-express", () => ({
  __esModule: true,
  default: (params: unknown) => configureMock(params)
}));

import { handler } from "./lambda";

describe("Lambda handler", () => {
  const event = { httpMethod: "GET", path: "/catalog" } as unknown as APIGatewayProxyEvent;
  const context = {} as Context;

  it("wraps the Nest/Express application with serverless-express and returns its response", async () => {
    const result = await handler(event, context, jest.fn());

    expect(configureMock).toHaveBeenCalledTimes(1);
    expect(configureMock).toHaveBeenCalledWith(expect.objectContaining({ app: expect.any(Function) }));
    expect(result).toEqual({ statusCode: 200, body: "ok" });
  });

  it("reuses the cached handler on a second invocation instead of rebooting Nest", async () => {
    await handler(event, context, jest.fn());

    expect(configureMock).toHaveBeenCalledTimes(1);
  });
});
