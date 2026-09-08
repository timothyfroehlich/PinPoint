import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AssigneePicker } from "./AssigneePicker";
import React from "react";

// Mock dependencies if any
// (AssigneePicker only uses local state and Lucide icons which are SVG, so simple render is fine)

const mockUsers = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Carol" },
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

  it("renders listbox options with correct roles and data-assigned", () => {
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
    // data-assigned is the stable signal this test uses for current assignee
    // state; this assertion intentionally does not rely on aria-selected
    // (which cmdk owns and uses for keyboard highlight).
    expect(unassignedOption).toHaveAttribute("data-assigned", "false");

    const aliceOption = screen.getByTestId("assignee-option-1");
    expect(aliceOption).toHaveAttribute("role", "option");
    expect(aliceOption).toHaveAttribute("data-assigned", "true");

    const bobOption = screen.getByTestId("assignee-option-2");
    expect(bobOption).toHaveAttribute("role", "option");
    expect(bobOption).toHaveAttribute("data-assigned", "false");
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

describe("AssigneePicker — Me quick-select", () => {
  it("shows 'Me' option when currentUserId matches a user in the list", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    const meOption = screen.getByTestId("assignee-option-me");
    expect(meOption).toBeInTheDocument();
    expect(meOption).toHaveTextContent("Me");
  });

  it("does NOT show 'Me' option when currentUserId is null", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId={null}
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    expect(screen.queryByTestId("assignee-option-me")).not.toBeInTheDocument();
  });

  it("does NOT show 'Me' option when currentUserId prop is omitted", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    expect(screen.queryByTestId("assignee-option-me")).not.toBeInTheDocument();
  });

  it("selecting 'Me' calls onAssign with the current user's ID", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="2"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));
    fireEvent.click(screen.getByTestId("assignee-option-me"));

    expect(onAssign).toHaveBeenCalledOnce();
    expect(onAssign).toHaveBeenCalledWith("2");
  });

  it("finds and selects the current user by name in addition to 'Me'", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    fireEvent.change(screen.getByTestId("assignee-search-input"), {
      target: { value: "ali" },
    });

    // The quick-select remains visible while the alphabetical list is filtered.
    expect(screen.getByTestId("assignee-option-me")).toBeInTheDocument();
    const aliceOption = screen.getByTestId("assignee-option-1");
    expect(aliceOption).toBeInTheDocument();
    expect(screen.queryByTestId("assignee-option-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assignee-option-3")).not.toBeInTheDocument();

    fireEvent.click(aliceOption);

    expect(onAssign).toHaveBeenCalledOnce();
    expect(onAssign).toHaveBeenCalledWith("1");
  });

  it("marks 'Me' with data-assigned when the current user is assigned", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId="1"
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="1"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    const meOption = screen.getByTestId("assignee-option-me");
    expect(meOption).toHaveAttribute("data-assigned", "true");
  });

  it("does NOT show 'Me' when currentUserId does not match any user in the list", () => {
    const onAssign = vi.fn();
    render(
      <AssigneePicker
        assignedToId={null}
        users={mockUsers}
        isPending={false}
        onAssign={onAssign}
        currentUserId="999"
      />
    );

    fireEvent.click(screen.getByTestId("assignee-picker-trigger"));

    expect(screen.queryByTestId("assignee-option-me")).not.toBeInTheDocument();
  });
});
