import { describe, expect, it } from "vitest";
import { summarizeCollection } from "./summary";
import type { CollectionMachine } from "./owner";

function machine(
  issues: CollectionMachine["issues"],
  presence: CollectionMachine["presenceStatus"] = "on_the_floor"
): CollectionMachine {
  return {
    id: crypto.randomUUID(),
    initials: "XX",
    name: "Test Machine",
    presenceStatus: presence,
    issues,
  };
}

const AT = new Date("2026-05-01T00:00:00Z");

describe("summarizeCollection", () => {
  it("counts machines by derived status and sums open issues", () => {
    const summary = summarizeCollection([
      machine([]), // operational
      machine([{ status: "new", severity: "major", createdAt: AT }]), // needs_service
      machine([
        { status: "new", severity: "unplayable", createdAt: AT },
        { status: "confirmed", severity: "minor", createdAt: AT },
      ]), // unplayable, 2 open
    ]);
    expect(summary).toEqual({
      total: 3,
      operational: 1,
      needsService: 1,
      unplayable: 1,
      openIssues: 3,
    });
  });

  it("handles the empty collection", () => {
    expect(summarizeCollection([])).toEqual({
      total: 0,
      operational: 0,
      needsService: 0,
      unplayable: 0,
      openIssues: 0,
    });
  });
});
