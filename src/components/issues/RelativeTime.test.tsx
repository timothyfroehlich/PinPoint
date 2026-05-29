import { render, screen, waitFor, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, afterEach } from "vitest";
import { RelativeTime } from "./RelativeTime";
import { RelativeTimeProvider } from "./RelativeTimeProvider";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RelativeTime", () => {
  it("renders the fallback in SSR output (no client effects)", () => {
    // Server render: useSyncExternalStore uses the server snapshot (null),
    // so the component renders the fallback. This is the whole reason this
    // component exists — a hydration-safe initial paint before swapping to
    // relative time.
    const html = renderToString(
      <RelativeTime
        value={new Date("2026-04-25T10:00:00Z")}
        fallback="Apr 25, 2026, 10:00 AM"
      />
    );
    expect(html).toContain("Apr 25, 2026, 10:00 AM");
    expect(html).not.toMatch(/ago|just now|in /);
  });

  it("swaps to a relative label after mount", async () => {
    const recent = new Date(Date.now() - 5 * 60_000); // 5 minutes ago
    render(
      <RelativeTimeProvider>
        <RelativeTime value={recent} fallback="Apr 25, 2026" />
      </RelativeTimeProvider>
    );

    await waitFor(() => {
      // date-fns formatDistanceToNow with addSuffix: true emits patterns like
      // "5 minutes ago", "less than a minute ago", "in 2 minutes", etc.
      expect(screen.getByText(/ago|just now|in /)).toBeInTheDocument();
    });
  });

  it("accepts a string value and parses it", async () => {
    render(
      <RelativeTimeProvider>
        <RelativeTime
          value="2026-04-25T10:00:00Z"
          fallback="Apr 25, 2026, 10:00 AM"
        />
      </RelativeTimeProvider>
    );

    // After mount, the provider fires its first tick and produces a relative
    // label. Even with a date months in the future or past, formatDistanceToNow
    // always emits something matching this pattern (e.g. "in X months", "X years ago").
    await waitFor(() => {
      expect(screen.getByText(/ago|just now|in /)).toBeInTheDocument();
    });
  });

  it("stays on the fallback when given an invalid date string", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {
      // intentionally silent
    });

    render(
      <RelativeTimeProvider>
        <RelativeTime value="not a date" fallback="N/A" />
      </RelativeTimeProvider>
    );

    // Effect should detect NaN getTime() and keep the fallback even after
    // the provider's first tick. No console.warn (we only warn from the
    // try/catch around formatRelative, which is never reached for NaN dates).
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("shared ticker stops when the provider unmounts", () => {
    const clearSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = render(
      <RelativeTimeProvider>
        <RelativeTime value={new Date()} fallback="now" />
      </RelativeTimeProvider>
    );
    unmount();
    // The provider's cleanup stops the shared interval.
    expect(clearSpy).toHaveBeenCalled();
  });

  it("renders fallback without a provider (no ticker running)", () => {
    // Without a provider the store snapshot stays null — all instances render
    // their fallback. This is a safe degraded mode (SSR, tests without wrapper).
    render(<RelativeTime value={new Date()} fallback="static label" />);
    expect(screen.getByText("static label")).toBeInTheDocument();
  });
});
