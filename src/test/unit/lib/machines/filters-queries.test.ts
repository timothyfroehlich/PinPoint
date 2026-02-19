import { describe, it, expect } from "vitest";
import {
  applyMachineFilters,
  sortMachines,
  type MachineWithDerivedStatus,
} from "~/lib/machines/filters-queries";

const MOCK_MACHINES: MachineWithDerivedStatus[] = [
  {
    id: "1",
    name: "Attack from Mars",
    initials: "AFM",
    status: "operational",
    presenceStatus: "on_the_floor",
    openIssuesCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ownerId: "user-1",
  },
  {
    id: "2",
    name: "Twilight Zone",
    initials: "TZ",
    status: "needs_service",
    presenceStatus: "on_loan",
    openIssuesCount: 2,
    createdAt: "2026-01-10T00:00:00Z",
    ownerId: "user-2",
  },
  {
    id: "3",
    name: "Medieval Madness",
    initials: "MM",
    status: "unplayable",
    presenceStatus: "removed",
    openIssuesCount: 5,
    createdAt: "2026-01-05T00:00:00Z",
    invitedOwnerId: "user-3",
  },
];

describe("applyMachineFilters", () => {
  it("filters by search query (name)", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, { q: "Mars" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].initials).toBe("AFM");
  });

  it("filters by search query (initials exact)", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, { q: "TZ" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].initials).toBe("TZ");
  });

  it("filters by status", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, {
      status: ["unplayable"],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].initials).toBe("MM");
  });

  it("filters by status (multiple)", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, {
      status: ["needs_service", "unplayable"],
    });
    expect(filtered).toHaveLength(2);
  });

  it("filters by ownerId", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, { owner: ["user-1"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].initials).toBe("AFM");
  });

  it("filters by invitedOwnerId", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, { owner: ["user-3"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].initials).toBe("MM");
  });

  it("returns all when no filters applied", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, {});
    expect(filtered).toHaveLength(3);
  });

  it("filters by presence status", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, {
      presence: ["on_the_floor"],
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].initials).toBe("AFM");
  });

  it("filters by multiple presence statuses", () => {
    const filtered = applyMachineFilters(MOCK_MACHINES, {
      presence: ["on_loan", "removed"],
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map((machine) => machine.initials)).toEqual(["TZ", "MM"]);
  });
});

describe("sortMachines", () => {
  it("sorts by name_asc", () => {
    const sorted = sortMachines(MOCK_MACHINES, "name_asc");
    expect(sorted[0].initials).toBe("AFM");
    expect(sorted[1].initials).toBe("MM");
    expect(sorted[2].initials).toBe("TZ");
  });

  it("sorts by name_desc", () => {
    const sorted = sortMachines(MOCK_MACHINES, "name_desc");
    expect(sorted[0].initials).toBe("TZ");
    expect(sorted[1].initials).toBe("MM");
    expect(sorted[2].initials).toBe("AFM");
  });

  it("sorts by status_desc (worst first)", () => {
    const sorted = sortMachines(MOCK_MACHINES, "status_desc");
    expect(sorted[0].status).toBe("unplayable");
    expect(sorted[1].status).toBe("needs_service");
    expect(sorted[2].status).toBe("operational");
  });

  it("sorts by issues_desc", () => {
    const sorted = sortMachines(MOCK_MACHINES, "issues_desc");
    expect(sorted[0].openIssuesCount).toBe(5);
    expect(sorted[1].openIssuesCount).toBe(2);
    expect(sorted[2].openIssuesCount).toBe(0);
  });

  it("sorts by created_desc", () => {
    const sorted = sortMachines(MOCK_MACHINES, "created_desc");
    expect(sorted[0].initials).toBe("TZ");
    expect(sorted[1].initials).toBe("MM");
    expect(sorted[2].initials).toBe("AFM");
  });
});
