import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WatchButton } from "~/components/issues/WatchButton";
import { toggleWatcherAction } from "~/app/(app)/issues/watcher-actions";

// Mock the server action
vi.mock("~/app/(app)/issues/watcher-actions", () => ({
  toggleWatcherAction: vi.fn(),
}));

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
    vi.mocked(toggleWatcherAction).mockResolvedValue({
      ok: true,
      value: { isWatching: true },
    });

    render(<WatchButton issueId="123" initialIsWatching={false} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(toggleWatcherAction).toHaveBeenCalledWith("123");
    });
  });

  it("shows loading spinner and keeps text static during pending state", async () => {
    // We can't easily control the pending state of useTransition in a unit test
    // without triggering an async action that pauses.
    // However, we can mock the action to delay, and verify state during that delay.

    let resolveAction: (value: any) => void;
    const actionPromise = new Promise((resolve) => {
      resolveAction = resolve;
    });

    vi.mocked(toggleWatcherAction).mockReturnValue(actionPromise as any);

    render(<WatchButton issueId="123" initialIsWatching={false} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    // It should be disabled/loading immediately
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Check for spinner (Button implementation uses Loader2 with animate-spin class)
    // We can search by the class if we can't find by icon role easily
    const spinner = button.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();

    // Text should REMAIN "Watch Issue" (not "Watching...")
    expect(button).toHaveTextContent("Watch Issue");
    expect(button).not.toHaveTextContent("Watching...");

    // Resolve the action to finish
    resolveAction!({ ok: true, value: { isWatching: true } });

    // Wait for final state
    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent("Unwatch Issue");
    });
  });
});
