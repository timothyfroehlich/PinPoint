import { describe, it, expect } from "vitest";
import {
  getSmartBadgeLabel,
  getAssigneeOrdering,
  getMachineQuickSelectOrdering,
} from "./filter-utils";
import { STATUS_GROUPS, OPEN_STATUSES, ALL_ISSUE_STATUSES } from "./status";
import type { IssueStatus } from "./status";

describe("getSmartBadgeLabel", () => {
  it("returns 'Status' when nothing selected", () => {
    expect(getSmartBadgeLabel([])).toBe("Status");
  });

  it("returns 'All' when all 11 statuses selected", () => {
    expect(getSmartBadgeLabel([...ALL_ISSUE_STATUSES])).toBe("All");
  });

  it("returns 'Open' when all new + in_progress statuses selected", () => {
    expect(getSmartBadgeLabel([...OPEN_STATUSES])).toBe("Open");
  });

  it("returns 'Closed' when all closed statuses selected", () => {
    expect(getSmartBadgeLabel([...STATUS_GROUPS.closed])).toBe("Closed");
  });

  it("returns group label when entire 'New' group selected", () => {
    expect(getSmartBadgeLabel([...STATUS_GROUPS.new])).toBe("Open");
  });

  it("returns group name when entire 'In Progress' group selected", () => {
    expect(getSmartBadgeLabel([...STATUS_GROUPS.in_progress])).toBe(
      "In Progress"
    );
  });

  it("returns single status name when one selected", () => {
    expect(getSmartBadgeLabel(["fixed" as IssueStatus])).toBe("Fixed");
  });

  it("returns 'N statuses' for mixed selection", () => {
    expect(
      getSmartBadgeLabel(["new", "in_progress", "fixed"] as IssueStatus[])
    ).toBe("3 statuses");
  });

  it("returns '2 statuses' for partial group selection", () => {
    expect(getSmartBadgeLabel(["new", "in_progress"] as IssueStatus[])).toBe(
      "2 statuses"
    );
  });
});

describe("getAssigneeOrdering", () => {
  const users = [
    { id: "u-charlie", name: "Charlie Adams" },
    { id: "u-alice", name: "Alice Baker" },
    { id: "u-bob", name: "Bob Martinez" },
  ];

  it("puts current user first as 'Me'", () => {
    const result = getAssigneeOrdering(users, "u-alice");
    expect(result[0]).toEqual({
      type: "quick-select",
      label: "Me",
      value: "u-alice",
      user: { id: "u-alice", name: "Alice Baker" },
    });
  });

  it("puts 'Unassigned' second", () => {
    const result = getAssigneeOrdering(users, "u-alice");
    expect(result[1]).toEqual({
      type: "quick-select",
      label: "Unassigned",
      value: "UNASSIGNED",
    });
  });

  it("includes separator after quick-selects", () => {
    const result = getAssigneeOrdering(users, "u-alice");
    expect(result[2]).toEqual({ type: "separator" });
  });

  it("sorts remaining users alphabetically", () => {
    const result = getAssigneeOrdering(users, "u-alice");
    const userItems = result.filter((item) => item.type === "user");
    expect(userItems.map((item) => item.user.name)).toEqual([
      "Bob Martinez",
      "Charlie Adams",
    ]);
  });

  it("handles null currentUserId (no 'Me' entry)", () => {
    const result = getAssigneeOrdering(users, null);
    expect(result[0]).toEqual({
      type: "quick-select",
      label: "Unassigned",
      value: "UNASSIGNED",
    });
    expect(result[1]).toEqual({ type: "separator" });
    const userItems = result.filter((item) => item.type === "user");
    expect(userItems).toHaveLength(3);
    expect(userItems.map((item) => item.user.name)).toEqual([
      "Alice Baker",
      "Bob Martinez",
      "Charlie Adams",
    ]);
  });
});

describe("getMachineQuickSelectOrdering", () => {
  const machines = [
    { initials: "TAF", ownerId: "u-other" },
    { initials: "AFM", ownerId: "u-me" },
    { initials: "CFTBL", ownerId: null },
    { initials: "HD", ownerId: "u-me" },
  ];

  it("puts 'My machines' first when user owns machines", () => {
    const result = getMachineQuickSelectOrdering(machines, "u-me");
    expect(result[0]).toEqual({
      type: "quick-select",
      label: "My machines",
      machines: [
        { initials: "AFM", ownerId: "u-me" },
        { initials: "HD", ownerId: "u-me" },
      ],
    });
  });

  it("omits 'My machines' when user owns no machines", () => {
    const result = getMachineQuickSelectOrdering(machines, "u-nobody");
    expect(result[0]).not.toEqual(
      expect.objectContaining({ type: "quick-select" })
    );
    // First item should be a machine, not a quick-select
    expect(result[0]?.type).toBe("machine");
  });

  it("includes separator after quick-select", () => {
    const result = getMachineQuickSelectOrdering(machines, "u-me");
    expect(result[1]).toEqual({ type: "separator" });
  });

  it("sorts remaining machines alphabetically by initials", () => {
    const result = getMachineQuickSelectOrdering(machines, "u-me");
    const machineItems = result.filter((item) => item.type === "machine");
    expect(machineItems.map((item) => item.machine.initials)).toEqual([
      "AFM",
      "CFTBL",
      "HD",
      "TAF",
    ]);
  });

  it("handles null currentUserId (no quick-select)", () => {
    const result = getMachineQuickSelectOrdering(machines, null);
    expect(result.every((item) => item.type === "machine")).toBe(true);
    expect(result).toHaveLength(4);
  });
});
