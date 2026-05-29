import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MachineFilters } from "~/components/machines/MachineFilters";
import "@testing-library/jest-dom/vitest";
import { TooltipProvider } from "~/components/ui/tooltip";

// Wrap renders in TooltipProvider since the global provider lives in the root layout
function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

// Mock next/navigation
const pushMock = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => "/machines",
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

describe("MachineFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    users: [],
    filters: {},
  };

  it("renders without crashing and shows search input", () => {
    renderWithProviders(<MachineFilters {...defaultProps} />);
    expect(
      screen.getByPlaceholderText(/search machines by name or initials/i)
    ).toBeInTheDocument();
  });

  it("selecting a sort option updates the active sort and pushes the expected URL param", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MachineFilters {...defaultProps} />);

    // Find the sort dropdown trigger button
    const sortTrigger = screen.getByRole("button", { name: /name \(a-z\)/i });
    expect(sortTrigger).toBeInTheDocument();

    // Click it to open the dropdown menu
    await user.click(sortTrigger);

    // Click the "Date Added (Newest)" option
    const option = await screen.findByText("Date Added (Newest)");
    expect(option).toBeInTheDocument();
    await user.click(option);

    // Expect pushFilters (which calls router.push) to be called with the sort param
    expect(pushMock).toHaveBeenCalledWith("/machines?sort=created_desc");
  });

  it("Clear All resets the filters and clears the URL params", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MachineFilters
        users={[]}
        filters={{
          q: "tz",
          sort: "created_desc",
          status: ["operational"],
          presence: ["off_the_floor"],
        }}
      />
    );

    // Verify search input has "tz"
    const searchInput = screen.getByPlaceholderText(
      /search machines by name or initials/i
    );
    expect(searchInput).toHaveValue("tz");

    // Verify "Clear All" button is present
    const clearAllButton = screen.getByRole("button", { name: /clear all/i });
    expect(clearAllButton).toBeInTheDocument();

    // Click "Clear All"
    await user.click(clearAllButton);

    // Verify search input is cleared
    expect(searchInput).toHaveValue("");

    // Verify pushMock was called to clear all params (status=all is pushed by useSearchFilters)
    expect(pushMock).toHaveBeenCalledWith("/machines?status=all");
  });

  it("mounting the component with a ?param already in searchParams reflects that filter as active", () => {
    const mockUsers = [
      {
        id: "user-1",
        name: "Alice",
        machineCount: 3,
        status: "active" as const,
      },
    ];

    renderWithProviders(
      <MachineFilters
        users={mockUsers}
        filters={{
          q: "tz",
          status: ["operational"],
          presence: ["off_the_floor"],
          owner: ["user-1"],
        }}
      />
    );

    // 1. Search input should show "tz"
    const searchInput = screen.getByPlaceholderText(
      /search machines by name or initials/i
    );
    expect(searchInput).toHaveValue("tz");

    // 2. Status badge "Operational" should be displayed
    const statusBadge = screen.getByText("Operational");
    expect(statusBadge).toBeInTheDocument();

    // 3. Availability badge "Off the Floor" should be displayed
    const presenceBadge = screen.getByText("Off the Floor");
    expect(presenceBadge).toBeInTheDocument();

    // 4. Owner badge "Alice" should be displayed
    const ownerBadge = screen.getByText("Alice");
    expect(ownerBadge).toBeInTheDocument();
  });

  it("clears individual status badge when click clear button on the badge", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MachineFilters
        users={[]}
        filters={{
          status: ["operational", "needs_service"],
        }}
      />
    );

    // Find the "Operational" badge and its clear button
    const operationalBadge = screen.getByText("Operational");
    const badgeElement = operationalBadge.closest(
      '[data-testid="filter-badge"]'
    );
    expect(badgeElement).toBeInTheDocument();

    const clearButton = badgeElement?.querySelector(
      'button[aria-label*="Clear"]'
    );
    expect(clearButton).toBeInTheDocument();

    // Click the clear button
    await user.click(clearButton!);

    // Expect pushMock to be called with only status=needs_service remaining
    expect(pushMock).toHaveBeenCalledWith("/machines?status=needs_service");
  });

  it("selecting status option in MultiSelect updates the URL param", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MachineFilters {...defaultProps} />);

    // Find the Status multi-select combobox button
    const statusSelect = screen.getByTestId("filter-status");
    expect(statusSelect).toBeInTheDocument();

    // Click it to open the popover
    await user.click(statusSelect);

    // Click the "Operational" option
    const option = await screen.findByText("Operational");
    expect(option).toBeInTheDocument();
    await user.click(option);

    // Expect pushMock to have been called with status=operational
    expect(pushMock).toHaveBeenCalledWith("/machines?status=operational");
  });
});
