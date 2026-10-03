import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchButton } from "./WatchButton";

const toggleWatcherAction = vi.fn();

vi.mock("~/app/(app)/issues/watcher-actions", () => ({
  toggleWatcherAction: (issueId: string): unknown =>
    toggleWatcherAction(issueId),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function renderWatch(props: {
  watcherCount: number;
  initialIsWatching: boolean;
}): ReturnType<typeof render> {
  return render(<WatchButton issueId="issue-1" canWatch {...props} />);
}

describe("WatchButton (spec issue-detail §9.6)", () => {
  beforeEach(() => {
    toggleWatcherAction.mockReset();
  });

  it("follows the server when props change to watching (posting a comment auto-watches, §8.5)", () => {
    const { rerender } = renderWatch({
      watcherCount: 0,
      initialIsWatching: false,
    });
    expect(screen.getByRole("button", { name: "Watch" })).toBeInTheDocument();
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("0");

    rerender(
      <WatchButton
        issueId="issue-1"
        canWatch
        watcherCount={1}
        initialIsWatching={true}
      />
    );

    expect(screen.getByRole("button", { name: "Unwatch" })).toBeInTheDocument();
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("1");
  });

  it("shows a toggle at once, then defers to the revalidated props", async () => {
    toggleWatcherAction.mockResolvedValue({
      ok: true,
      value: { isWatching: true },
    });
    const { rerender } = renderWatch({
      watcherCount: 2,
      initialIsWatching: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Unwatch" })
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("3");

    // Revalidation agrees, and later someone else's change lands too.
    rerender(
      <WatchButton
        issueId="issue-1"
        canWatch
        watcherCount={4}
        initialIsWatching={true}
      />
    );
    expect(screen.getByRole("button", { name: "Unwatch" })).toBeInTheDocument();
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("4");

    // The server says this viewer stopped watching elsewhere: no stale
    // optimistic state survives.
    rerender(
      <WatchButton
        issueId="issue-1"
        canWatch
        watcherCount={3}
        initialIsWatching={false}
      />
    );
    expect(screen.getByRole("button", { name: "Watch" })).toBeInTheDocument();
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("3");
  });
});
