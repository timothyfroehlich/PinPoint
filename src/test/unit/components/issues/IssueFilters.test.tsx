import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IssueFilters } from "~/components/issues/IssueFilters";
import { STATUS_GROUPS, OPEN_STATUSES } from "~/lib/issues/status";
import type { IssueStatus } from "~/lib/types";
import "@testing-library/jest-dom/vitest";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => "/issues",
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

describe("IssueFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    machines: [],
    users: [],
    filters: {}, // No filters = default state
  };

  it("shows no status badges on landing (default state)", async () => {
    render(<IssueFilters {...defaultProps} />);
    // Wait for layout effect
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("clears 'New' group statuses when X is clicked", async () => {
    render(
      <IssueFilters
        {...defaultProps}
        filters={{ status: [...OPEN_STATUSES] }}
      />
    );

    // Wait for badges to render (layout effect)
    const newBadge = await screen.findByText("New");
    expect(newBadge).toBeInTheDocument();

    // Find the 'x' button inside the "New" badge
    // The badge structure: Badge > Icon > Label > Button > X
    // We can find the button by its aria-label or just by being a button sibling
    // But our component doesn't have aria-labels on these buttons yet (except in Hidden Filters).
    // Let's find by role 'button' within the badge
    const badgeElement = newBadge.closest(".inline-flex"); // Badge class
    const clearButton = badgeElement?.querySelector("button");

    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton!);

    // Expect push to be called with statuses excluding 'new' group
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
    const badgeElement = fixedBadge.closest(".inline-flex");
    const clearButton = badgeElement?.querySelector("button");

    fireEvent.click(clearButton!);

    // Expect push to be called with NO status param (or empty status)
    // If status array is empty, we expect explicit "all" to prevent default "open" fallback
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining("status=all")
    );
  });
});
