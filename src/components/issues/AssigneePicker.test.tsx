import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AssigneePicker } from "./AssigneePicker";
import React from "react";

// Mock dependencies if any
// (AssigneePicker only uses local state and Lucide icons which are SVG, so simple render is fine)

const mockUsers = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

describe("AssigneePicker Accessibility", () => {
  it("renders with correct accessibility attributes", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
      />
    );

    const trigger = screen.getByTestId("assignee-picker-trigger");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");

    // Check hidden SVG
    const svg = trigger.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders listbox options with correct roles and aria-selected", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId="1"
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
      />
    );

    const trigger = screen.getByTestId("assignee-picker-trigger");
    fireEvent.click(trigger);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();

    const searchInput = screen.getByTestId("assignee-search-input");
    expect(searchInput).toHaveAttribute("aria-label", "Filter users");

    const unassignedOption = screen.getByTestId("assignee-option-unassigned");
    expect(unassignedOption).toHaveAttribute("role", "option");
    expect(unassignedOption).toHaveAttribute("aria-selected", "false");

    const aliceOption = screen.getByTestId("assignee-option-1");
    expect(aliceOption).toHaveAttribute("role", "option");
    expect(aliceOption).toHaveAttribute("aria-selected", "true");

    const bobOption = screen.getByTestId("assignee-option-2");
    expect(bobOption).toHaveAttribute("role", "option");
    expect(bobOption).toHaveAttribute("aria-selected", "false");
  });

  it("renders loading state with accessible attributes", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId="1"
        users={mockUsers}
        isPending={true}
        onAssign={onAssign}
      />
    );

    const trigger = screen.getByTestId("assignee-picker-trigger");
    expect(trigger).toBeDisabled();

    // Ensure loader is present and accessible
    const loader = screen.getByTestId("assignee-picker-loader");
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute("aria-hidden", "true");
    expect(loader).toHaveClass("animate-spin");
  });
});
