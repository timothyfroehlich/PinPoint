import { describe, expect, it } from "vitest";
import { summarizeCollection } from "./summary";
import type { CollectionMachine } from "./owner";
import { healthFromSeverityCounts } from "~/lib/machines/view/model";

function machine(
  initials: string,
  presence: CollectionMachine["presenceStatus"] = "on_the_floor"
): CollectionMachine {
  return {
    id: crypto.randomUUID(),
    initials,
    name: "Test Machine",
    presenceStatus: presence,
  };
}

function health(
  major: number,
  unplayable: number,
  minor = 0
): ReturnType<typeof healthFromSeverityCounts> {
  return healthFromSeverityCounts({
    cosmetic: 0,
    minor,
    major,
    unplayable,
    oldestOpenIssueAt: null,
  });
}

describe("summarizeCollection", () => {
  it("counts machines by derived status and sums open issues", () => {
    const machines = [machine("AA"), machine("BB"), machine("CC")];
    const summary = summarizeCollection(
      machines,
      new Map([
        ["AA", health(0, 0)],
        ["BB", health(1, 0)],
        ["CC", health(0, 1, 1)],
      ])
    );
    expect(summary).toEqual({
      total: 3,
      operational: 1,
      needsService: 1,
      unplayable: 1,
      openIssues: 3,
    });
  });

  it("handles the empty collection", () => {
    expect(summarizeCollection([], new Map())).toEqual({
      total: 0,
      operational: 0,
      needsService: 0,
      unplayable: 0,
      openIssues: 0,
    });
  });
});
