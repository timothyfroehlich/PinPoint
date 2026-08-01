import { describe, it, expect } from "vitest";
import {
  resolveListingHolder,
  findListingTies,
  type ListingHolderCandidate,
} from "./listing-holder";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

function machine(
  id: string,
  presenceStatus: MachinePresenceStatus,
  opts: { listed?: boolean; titleId?: number | null } = {}
): ListingHolderCandidate {
  return {
    id,
    pinballmapMachineId: opts.titleId === undefined ? 42 : opts.titleId,
    pinballmapListed: opts.listed ?? false,
    presenceStatus,
  };
}

describe("resolveListingHolder", () => {
  describe("an existing listing is knowledge — the incumbent wins", () => {
    it("returns the listed machine, with no tie, however many share its availability", () => {
      // Three same-title cabinets all on the floor. Without rule 1 this is the
      // worst possible tie; with it there is no ambiguity at all, because WE
      // created that lmx and therefore know whose it is.
      const holder = resolveListingHolder([
        machine("a", "on_the_floor"),
        machine("b", "on_the_floor", { listed: true }),
        machine("c", "on_the_floor"),
      ]);

      expect(holder).toEqual({ kind: "incumbent", machineId: "b" });
    });

    it("keeps the incumbent even when a better-ranked cabinet appears", () => {
      // The listed one is off the floor and an unlisted one is on it. The
      // incumbent still holds the listing — auto-link must not migrate it.
      const holder = resolveListingHolder([
        machine("fresh", "on_the_floor"),
        machine("incumbent", "off_the_floor", { listed: true }),
      ]);

      expect(holder).toEqual({ kind: "incumbent", machineId: "incumbent" });
    });

    it("keeps the incumbent even when its own availability makes Listed invalid", () => {
      // A listed machine marked `removed` is a §6 matrix problem — a hard flag
      // the dashboard counts — NOT a tie. It still holds the listing.
      const holder = resolveListingHolder([
        machine("gone", "removed", { listed: true }),
        machine("here", "on_the_floor"),
      ]);

      expect(holder).toEqual({ kind: "incumbent", machineId: "gone" });
    });
  });

  describe("nobody listed — we would have to pick, so the tie rule applies", () => {
    it("picks the sole machine at the lowest presence rank", () => {
      const holder = resolveListingHolder([
        machine("floor", "on_the_floor"),
        machine("off", "off_the_floor"),
      ]);

      expect(holder).toEqual({ kind: "candidate", machineId: "floor" });
    });

    it("stands down when two tie at the lowest rank", () => {
      const holder = resolveListingHolder([
        machine("b", "on_the_floor"),
        machine("a", "on_the_floor"),
        machine("c", "off_the_floor"),
      ]);

      // Ids sorted, so callers and snapshots are stable.
      expect(holder).toEqual({ kind: "tie", machineIds: ["a", "b"] });
    });

    it("drops availabilities that make Listed invalid before ranking", () => {
      // `removed` and `pending_arrival` are `invalid` in the §6 matrix, so they
      // are not candidates at all — leaving one legitimate pick, not a tie.
      const holder = resolveListingHolder([
        machine("gone", "removed"),
        machine("soon", "pending_arrival"),
        machine("loaned", "on_loan"),
      ]);

      expect(holder).toEqual({ kind: "candidate", machineId: "loaned" });
    });

    it("reports none when every machine's availability makes Listed invalid", () => {
      const holder = resolveListingHolder([
        machine("gone", "removed"),
        machine("soon", "pending_arrival"),
      ]);

      expect(holder).toEqual({ kind: "none" });
    });

    it("ties only among the valid ones, ignoring invalid cabinets entirely", () => {
      const holder = resolveListingHolder([
        machine("x", "on_loan"),
        machine("y", "on_loan"),
        machine("dead", "removed"),
      ]);

      expect(holder).toEqual({ kind: "tie", machineIds: ["x", "y"] });
    });
  });

  describe("degenerate inputs", () => {
    it("reports none for an empty group", () => {
      expect(resolveListingHolder([])).toEqual({ kind: "none" });
    });

    it("treats a single valid machine as a candidate, not a tie", () => {
      expect(resolveListingHolder([machine("only", "on_the_floor")])).toEqual({
        kind: "candidate",
        machineId: "only",
      });
    });
  });
});

describe("findListingTies", () => {
  it("groups the fleet by catalog title and reports only the tied titles", () => {
    const ties = findListingTies([
      // Title 1 — tied, nobody listed.
      machine("a", "on_the_floor", { titleId: 1 }),
      machine("b", "on_the_floor", { titleId: 1 }),
      // Title 2 — has an incumbent, so not a tie.
      machine("c", "on_the_floor", { titleId: 2, listed: true }),
      machine("d", "on_the_floor", { titleId: 2 }),
      // Title 3 — a clear single candidate.
      machine("e", "on_the_floor", { titleId: 3 }),
    ]);

    expect(ties).toEqual([{ pinballmapMachineId: 1, machineIds: ["a", "b"] }]);
  });

  it("ignores unmatched machines, which have no title to contend over", () => {
    expect(
      findListingTies([
        machine("a", "on_the_floor", { titleId: null }),
        machine("b", "on_the_floor", { titleId: null }),
      ])
    ).toEqual([]);
  });

  it("returns ties ordered by title id, so the report is stable", () => {
    const ties = findListingTies([
      machine("c", "on_the_floor", { titleId: 9 }),
      machine("d", "on_the_floor", { titleId: 9 }),
      machine("a", "on_the_floor", { titleId: 4 }),
      machine("b", "on_the_floor", { titleId: 4 }),
    ]);

    expect(ties.map((t) => t.pinballmapMachineId)).toEqual([4, 9]);
  });

  it("is empty for a fleet with no duplicate titles", () => {
    expect(
      findListingTies([
        machine("a", "on_the_floor", { titleId: 1 }),
        machine("b", "on_the_floor", { titleId: 2 }),
      ])
    ).toEqual([]);
  });
});
