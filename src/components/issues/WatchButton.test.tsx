import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WatchButton } from "./WatchButton";
import React from "react";

// Mock the server action
vi.mock("~/app/(app)/issues/watcher-actions", () => ({
  toggleWatcherAction: vi.fn(),
}));

import { toggleWatcherAction } from "~/app/(app)/issues/watcher-actions";

describe("WatchButton", () => {
  it("renders correctly when not watching", () => {
    render(<WatchButton issueId="123" initialIsWatching={false} />);
    expect(screen.getByRole("button")).toHaveTextContent("Watch Issue");
    expect(screen.queryByText("Unwatch Issue")).not.toBeInTheDocument();
  });

  it("renders correctly when watching", () => {
    render(<WatchButton issueId="123" initialIsWatching={true} />);
    expect(screen.getByRole("button")).toHaveTextContent("Unwatch Issue");
    expect(screen.queryByText("Watch Issue")).not.toBeInTheDocument();
  });

  it("calls toggleWatcherAction on click", async () => {
    (toggleWatcherAction as any).mockResolvedValue({
      ok: true,
      value: { isWatching: true },
    });

    render(<WatchButton issueId="123" initialIsWatching={false} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(toggleWatcherAction).toHaveBeenCalledWith("123");
    });
  });
});
