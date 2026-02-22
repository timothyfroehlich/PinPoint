import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { STATUS_GROUPS, OPEN_STATUSES } from "~/lib/issues/status";
import type { IssueStatus } from "~/lib/types";
import "@testing-library/jest-dom/vitest";

// Mock next/navigation
const pushMock = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => "/issues",
  useSearchParams: () => mockSearchParams,
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// Mock requestAnimationFrame
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
  setTimeout(cb, 0)
);

// Mock client-side cookie storage
vi.mock("~/lib/cookies/client", () => ({
  storeLastIssuesPath: vi.fn(),
}));

describe("IssueFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    machines: [],
    users: [],
    filters: {}, // No filters = default state
  };

  it("shows status badges on landing (default state)", async () => {
    render(<IssueFilters {...defaultProps} />);
    // Wait for layout effect
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Default state: Open statuses are selected, so badges should be visible
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("clears 'Open' group statuses when X is clicked", async () => {
    render(
      <IssueFilters
        {...defaultProps}
        filters={{ status: [...OPEN_STATUSES] }}
      />
    );

    // Wait for badges to render (layout effect)
    const openBadge = await screen.findByText("Open");
    expect(openBadge).toBeInTheDocument();

    // Find the 'x' button inside the "Open" badge
    // The new badge structure uses data-testid="filter-badge"
    const badgeElement = openBadge.closest('[data-testid="filter-badge"]');
    const clearButton = badgeElement?.querySelector(
      'button[aria-label*="Clear"]'
    );

    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton!);

    // Expect push to be called with statuses excluding 'new' group (displayed as "Open")
    // Default = OPEN_STATUSES
    // New Group = NEW_STATUSES (new, confirmed)
    // Expected = OPEN_STATUSES without NEW_STATUSES
    const expectedStatuses = OPEN_STATUSES.filter(
      (s: IssueStatus) => !STATUS_GROUPS.new.includes(s)
    );

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining(`status=${expectedStatuses.join("%2C")}`)
    );
  });

  it("clears individual status when X is clicked", async () => {
    // Setup filter with just "fixed" status (closed group)
    render(<IssueFilters {...defaultProps} filters={{ status: ["fixed"] }} />);

    const fixedBadge = await screen.findByText("Fixed");
    const badgeElement = fixedBadge.closest('[data-testid="filter-badge"]');
    const clearButton = badgeElement?.querySelector(
      'button[aria-label*="Clear"]'
    );

    fireEvent.click(clearButton!);

    // Expect push to be called with NO status param (or empty status)
    // If status array is empty, we expect explicit "all" to prevent default "open" fallback
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("status=all")
    );
  });
});
