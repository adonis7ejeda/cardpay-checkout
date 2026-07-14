import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SplashScreen } from "./SplashScreen";

describe("SplashScreen", () => {
  it("shows the brand and a loading indicator while hydrating, without calling onReady", () => {
    const onReady = jest.fn();
    render(<SplashScreen hydrating onReady={onReady} />);
    expect(screen.getByText("CardPay")).toBeTruthy();
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("calls onReady exactly once as soon as real hydration finishes, with no hard-coded timer", () => {
    const onReady = jest.fn();
    const { rerender } = render(<SplashScreen hydrating onReady={onReady} />);
    expect(onReady).not.toHaveBeenCalled();
    rerender(<SplashScreen hydrating={false} onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("accepts no user input controls", () => {
    render(<SplashScreen hydrating onReady={jest.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("adjustable")).toHaveLength(0);
  });
});
