import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import App, { resolveApiBaseUrl } from "./App";

describe("App", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Deterministically simulate an unavailable network instead of letting
    // HttpApiClient's default fetcher make a real request during the test.
    global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("boots into the Splash screen and hydrates into Home without crashing when the network is unavailable", async () => {
    render(<App />);
    expect(screen.getByText("CardPay")).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText("Loading")).toBeNull());
  });

});

describe("resolveApiBaseUrl", () => {
  it("uses Config.API_BASE_URL when react-native-config provides an override", () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: "http://test-override:1234" })).toBe("http://test-override:1234");
  });

  it("falls back to the deployed AWS Lambda URL when no override is configured", () => {
    expect(resolveApiBaseUrl({})).toBe("https://bhvb87rakj.execute-api.us-east-1.amazonaws.com/prod");
  });
});
