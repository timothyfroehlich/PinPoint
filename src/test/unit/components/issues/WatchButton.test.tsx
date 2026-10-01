import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WatchButton } from "~/components/issues/WatchButton";
import { toggleWatcherAction } from "~/app/(app)/issues/watcher-actions";

vi.mock("~/app/(app)/issues/watcher-actions", () => ({
  toggleWatcherAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("WatchButton (Details › Watching, spec §9.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the count and a Watch toggle for a signed-in viewer", () => {
    render(
      <WatchButton
        issueId="123"
        watcherCount={2}
        initialIsWatching={false}
        canWatch
      />
    );
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Watch" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("shows the count only for a signed-out visitor", () => {
    render(
      <WatchButton
        issueId="123"
        watcherCount={2}
        initialIsWatching={false}
        canWatch={false}
      />
    );
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("2");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("watching updates the toggle and the count without waiting for a reload", async () => {
    vi.mocked(toggleWatcherAction).mockResolvedValue({
      ok: true,
      value: { isWatching: true },
    });
    render(
      <WatchButton
        issueId="123"
        watcherCount={2}
        initialIsWatching={false}
        canWatch
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Watch" }));

    expect(
      await screen.findByRole("button", { name: "Unwatch" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("3");
    expect(toggleWatcherAction).toHaveBeenCalledWith("123");
  });

  it("unwatching lowers the count", async () => {
    vi.mocked(toggleWatcherAction).mockResolvedValue({
      ok: true,
      value: { isWatching: false },
    });
    render(
      <WatchButton issueId="123" watcherCount={3} initialIsWatching canWatch />
    );

    fireEvent.click(screen.getByRole("button", { name: "Unwatch" }));

    await waitFor(() => {
      expect(screen.getByTestId("watcher-count")).toHaveTextContent("2");
    });
  });
});
