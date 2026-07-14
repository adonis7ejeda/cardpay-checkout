import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { BackdropShell } from "./BackdropShell";

describe("BackdropShell", () => {
  it("renders nothing when closed", () => {
    render(
      <BackdropShell title="Card details" open={false} onCancel={jest.fn()}>
        <Text>content</Text>
      </BackdropShell>
    );
    expect(screen.queryByText("Card details")).toBeNull();
  });

  it("renders the title, children, and a cancel affordance when open", () => {
    const onCancel = jest.fn();
    render(
      <BackdropShell title="Card details" open onCancel={onCancel}>
        <Text>content</Text>
      </BackdropShell>
    );
    expect(screen.getByText("Card details")).toBeTruthy();
    expect(screen.getByText("content")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
