import { describe, it, expect } from "vitest";
import { getAssigneeOrdering } from "./filter-utils";

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
