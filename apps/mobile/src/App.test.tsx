import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import App from "./App";

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
