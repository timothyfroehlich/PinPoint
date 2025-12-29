import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WatchButton } from "./WatchButton";
import * as actions from "~/app/(app)/issues/watcher-actions";

// Mock the server action
vi.mock("~/app/(app)/issues/watcher-actions", () => ({
  toggleWatcherAction: vi.fn(),
}));

describe("WatchButton", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders correct initial state (watching)", () => {
    render(<WatchButton issueId="123" initialIsWatching={true} />);
    expect(
      screen.getByRole("button", { name: "Unwatch Issue" })
    ).toBeInTheDocument();
  });

  it("renders correct initial state (not watching)", () => {
    render(<WatchButton issueId="123" initialIsWatching={false} />);
    expect(
      screen.getByRole("button", { name: "Watch Issue" })
    ).toBeInTheDocument();
  });

  it("shows loading state when clicked", async () => {
    const user = userEvent.setup();
    let resolveAction: (value: any) => void;
    const actionPromise = new Promise((resolve) => {
      resolveAction = resolve;
    });

    vi.mocked(actions.toggleWatcherAction).mockReturnValue(
      actionPromise as any
    );

    render(<WatchButton issueId="123" initialIsWatching={false} />);

    const button = screen.getByRole("button", { name: "Watch Issue" });
    await user.click(button);

    // It should be disabled
    expect(button).toBeDisabled();
    // It should show loading text
    expect(
      screen.getByRole("button", { name: "Updating..." })
    ).toBeInTheDocument();

    // Let's resolve it
    resolveAction!({ ok: true, value: { isWatching: true } });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Unwatch Issue" })
      ).toBeEnabled();
    });
  });
});
