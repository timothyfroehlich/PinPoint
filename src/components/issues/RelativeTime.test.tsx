import { render, screen, waitFor, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, afterEach } from "vitest";
import { RelativeTime } from "./RelativeTime";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RelativeTime", () => {
  it("renders the fallback in SSR output (no client effects)", () => {
    // Server render: useEffect doesn't run, so label stays null and fallback
    // is what hits the wire. This is the whole reason this component exists —
    // a hydration-safe initial paint before swapping to relative time.
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
    render(<RelativeTime value={recent} fallback="Apr 25, 2026" />);

    await waitFor(() => {
      // date-fns formatDistanceToNow with addSuffix: true emits patterns like
      // "5 minutes ago", "less than a minute ago", "in 2 minutes", etc.
      expect(screen.getByText(/ago|just now|in /)).toBeInTheDocument();
    });
  });

  it("accepts a string value and parses it", async () => {
    render(
      <RelativeTime
        value="2026-04-25T10:00:00Z"
        fallback="Apr 25, 2026, 10:00 AM"
      />
    );

    // After mount, the effect runs and produces a relative label. Even with a
    // date months in the future or past, formatDistanceToNow always emits
    // something matching this pattern (e.g. "in X months", "X years ago").
    await waitFor(() => {
      expect(screen.getByText(/ago|just now|in /)).toBeInTheDocument();
    });
  });

  it("stays on the fallback when given an invalid date string", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {
      // intentionally silent
    });

    render(<RelativeTime value="not a date" fallback="N/A" />);

    // Effect should early-return on NaN getTime() — no throw, no setLabel,
    // and no console.warn (we only warn from the try/catch around formatRelative).
    expect(screen.getByText("N/A")).toBeInTheDocument();

    // Advance any pending microtasks; fallback must still be shown.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("clears its interval on unmount", () => {
    const clearSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = render(
      <RelativeTime value={new Date()} fallback="now" />
    );
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
