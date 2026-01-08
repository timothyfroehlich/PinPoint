import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IssueFilters } from "./IssueFilters";
import React from "react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Select components from shadcn/radix
// We need to mock them because they rely on Context which is hard to test in isolation without full DOM
// But for this test, we care about the structure we returned in IssueFilters.tsx.
// However, since we are using the actual Shadcn components which use Radix, they might not render standard <select> elements.
// The IssueFilters component uses <SelectTrigger> which renders a button. We added aria-label to it.

describe("IssueFilters Accessibility", () => {
  const mockMachines = [
    { initials: "TZ", name: "Twilight Zone" },
    { initials: "MM", name: "Medieval Madness" },
  ];

  it("renders status filter group with accessibility attributes", () => {
    render(<IssueFilters machines={mockMachines} />);

    // Check status group container
    const statusGroup = screen.getByRole("group", { name: "Filter by status" });
    expect(statusGroup).toBeInTheDocument();

    // Check toggle buttons
    const openButton = screen.getByRole("button", { name: "Open" });
    const closedButton = screen.getByRole("button", { name: "Closed" });

    // Initial state (assuming query params are empty/default): Open is active
    // Wait, the component defaults to Open if status is NOT "resolved".
    expect(openButton).toHaveAttribute("aria-pressed", "true");
    expect(closedButton).toHaveAttribute("aria-pressed", "false");
  });

  it("renders select triggers with accessible labels", () => {
    render(<IssueFilters machines={mockMachines} />);

    // We added aria-label to SelectTrigger.
    // Shadcn SelectTrigger renders a button.

    // Severity
    const severityTrigger = screen.getByRole("combobox", { name: "Filter by Severity" });
    expect(severityTrigger).toBeInTheDocument();

    // Priority
    const priorityTrigger = screen.getByRole("combobox", { name: "Filter by Priority" });
    expect(priorityTrigger).toBeInTheDocument();

    // Machine
    const machineTrigger = screen.getByRole("combobox", { name: "Filter by Machine" });
    expect(machineTrigger).toBeInTheDocument();
  });
});
