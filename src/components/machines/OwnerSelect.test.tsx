/**
 * RTL Unit Tests: OwnerSelect — H-class UI state assertions
 *
 * Covers:
 * 1. Guests hidden by default, revealed via "Show guests and invited users" checkbox
 * 2. Typed search bypasses the guest filter
 * 3. Invited users also hidden by default, revealed via checkbox
 *
 * These tests were downgraded from e2e/full/machine-owner-picker.spec.ts (tests
 * at lines 40, 67) per the 2026-05 audit row #28 (KEEP-reduced, H-class to RTL).
 *
 * The class-F promote-dialog tests (lines 113, 162 of the E2E spec) remain in
 * e2e/full/machine-owner-picker.spec.ts as they require a real server round-trip.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OwnerSelect, type OwnerSelectUser } from "./OwnerSelect";

// InviteUserDialog makes real server action calls — stub it out to keep
// this unit test isolated from network and Next.js server infrastructure.
vi.mock("~/components/users/InviteUserDialog", () => ({
  InviteUserDialog: vi.fn(() => null),
}));

// compareUnifiedUsers does not need mocking — it's pure sort logic.

const MEMBER_USER: OwnerSelectUser = {
  id: "user-member-1",
  name: "Alice Member",
  lastName: "Member",
  machineCount: 2,
  status: "active",
  role: "member",
};

const GUEST_USER: OwnerSelectUser = {
  id: "user-guest-1",
  name: "Guest User",
  lastName: "User",
  machineCount: 0,
  status: "active",
  role: "guest",
};

const INVITED_MEMBER: OwnerSelectUser = {
  id: "user-invited-1",
  name: "Invited Member",
  lastName: "Member",
  machineCount: 0,
  status: "invited",
  role: "member",
};

const ALL_USERS = [MEMBER_USER, GUEST_USER, INVITED_MEMBER];

/** Open the popover by clicking the owner-select trigger. */
function openPopover() {
  fireEvent.click(screen.getByTestId("owner-select"));
}

describe("OwnerSelect — default state hides guests and invited users", () => {
  it("does not show guest users in the command list by default", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    openPopover();

    // Member user is visible
    expect(screen.getByText("Alice Member")).toBeInTheDocument();

    // Guest user is NOT visible in the list (the option is not rendered)
    expect(screen.queryByText("Guest User")).not.toBeInTheDocument();
  });

  it("does not show invited users in the command list by default", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    openPopover();

    // Invited member is NOT visible by default
    expect(screen.queryByText("Invited Member")).not.toBeInTheDocument();
  });

  it("reveals guest and invited users after checking the checkbox", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    openPopover();

    const checkbox = screen.getByRole("checkbox", {
      name: /Show guests and invited users/i,
    });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Both guest and invited users now appear
    expect(screen.getByText("Guest User")).toBeInTheDocument();
    expect(screen.getByText("Invited Member")).toBeInTheDocument();
  });

  it("shows the (GUEST) badge next to guest users when revealed", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    openPopover();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Show guests and invited users/i })
    );

    // The GUEST badge is rendered inside the command list item
    expect(screen.getByText("(GUEST)")).toBeInTheDocument();
  });
});

describe("OwnerSelect — typed search bypasses the guest filter", () => {
  it("shows guest users when their name matches the search query", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    openPopover();

    // Before search, Guest User is hidden
    expect(screen.queryByText("Guest User")).not.toBeInTheDocument();

    // Type in the search input
    const searchInput = screen.getByPlaceholderText("Search users...");
    fireEvent.change(searchInput, { target: { value: "Guest" } });

    // Guest User now appears because search bypasses the filter
    expect(screen.getByText("Guest User")).toBeInTheDocument();
  });

  it("shows invited users when their name matches the search query", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    openPopover();

    const searchInput = screen.getByPlaceholderText("Search users...");
    fireEvent.change(searchInput, { target: { value: "Invited" } });

    expect(screen.getByText("Invited Member")).toBeInTheDocument();
  });

  it("only shows matching users when search is active", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    openPopover();

    const searchInput = screen.getByPlaceholderText("Search users...");
    fireEvent.change(searchInput, { target: { value: "Guest" } });

    // Guest User appears
    expect(screen.getByText("Guest User")).toBeInTheDocument();

    // Alice Member does NOT appear (doesn't match "Guest")
    expect(screen.queryByText("Alice Member")).not.toBeInTheDocument();
  });
});

describe("OwnerSelect — selected user display", () => {
  it("shows placeholder when no default value is set", () => {
    render(<OwnerSelect users={ALL_USERS} />);
    expect(screen.getByTestId("owner-select")).toHaveTextContent(
      "Select an owner"
    );
  });

  it("shows the selected member user's name on the trigger", () => {
    render(<OwnerSelect users={ALL_USERS} defaultValue={MEMBER_USER.id} />);
    expect(screen.getByTestId("owner-select")).toHaveTextContent(
      "Alice Member"
    );
  });

  it("shows (GUEST) badge on trigger when a guest is the selected value", () => {
    render(<OwnerSelect users={ALL_USERS} defaultValue={GUEST_USER.id} />);
    const trigger = screen.getByTestId("owner-select");
    expect(trigger).toHaveTextContent("Guest User");
    expect(trigger).toHaveTextContent("(GUEST)");
  });
});
