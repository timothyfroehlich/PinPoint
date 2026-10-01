import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
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
    const toggle = screen.getByRole("button", { name: "Watch" });
    // The visible text is the whole name (WCAG 2.5.3): no aria-label.
    expect(toggle).not.toHaveAttribute("aria-label");
    expect(toggle).not.toHaveAttribute("aria-pressed");
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

    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Watch" });
    await user.click(toggle);

    // The button now offers the opposite action, by its visible text.
    await waitFor(() => {
      expect(toggle).toHaveAccessibleName("Unwatch");
    });
    // Saving never disables the button, which would drop focus to <body>.
    expect(toggle).toHaveFocus();
    expect(screen.getByTestId("watcher-count")).toHaveTextContent("3");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Watching. 3 watchers"
    );
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

    const toggle = screen.getByRole("button", { name: "Unwatch" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByTestId("watcher-count")).toHaveTextContent("2");
    });
    expect(toggle).toHaveAccessibleName("Watch");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Not watching. 2 watchers"
    );
  });
});
