import { describe, expect, it } from "vitest";
import {
  QUICK_SEARCH_RESULT_LIMIT,
  matchQuickSearchMachines,
} from "~/lib/quick-search/match";
import type { QuickSearchMachineIndexEntry } from "~/lib/quick-search/types";

function machine(
  initials: string,
  name: string,
  model: Partial<
    Pick<QuickSearchMachineIndexEntry, "modelName" | "manufacturer" | "year">
  > = {}
): QuickSearchMachineIndexEntry {
  return {
    id: `machine-${initials}`,
    initials,
    name,
    modelName: model.modelName ?? null,
    manufacturer: model.manufacturer ?? null,
    year: model.year ?? null,
  };
}

function initialsFor(
  machines: QuickSearchMachineIndexEntry[],
  query: string
): string[] {
  return matchQuickSearchMachines(machines, query).map(
    (result) => result.initials
  );
}

describe("matchQuickSearchMachines", () => {
  it("ranks exact initials, then prefixes, then contained text (spec 4.3, 4.4)", () => {
    const machines = [
      machine("XYZ", "Pirates of the Caribbean", { modelName: "Mars" }),
      machine("AF2", "AFM Tournament Edition"),
      machine("ZZZ", "Return to Mars"),
      machine("MRS", "Big Guns", { modelName: "Mars Attack" }),
      machine("AFM", "Attack from Mars"),
    ];

    expect(initialsFor(machines, "afm")).toEqual(["AFM", "AF2"]);
    // Model prefix (MRS, XYZ) ahead of contained text (AFM, ZZZ); name breaks ties.
    expect(initialsFor(machines, "Mars")).toEqual(["MRS", "XYZ", "AFM", "ZZZ"]);
  });

  it("matches model identity, current manufacturer, and year", () => {
    const machines = [
      machine("GODZ", "Big G", { modelName: "Godzilla Premium" }),
      machine("PBM", "Z Cabinet", { manufacturer: "Bally", year: "1995" }),
      machine("MAN", "A Cabinet", {
        manufacturer: "The Bally Company",
        year: "1987",
      }),
    ];

    expect(matchQuickSearchMachines(machines, "Godzilla Premium")).toEqual([
      {
        id: "machine-GODZ",
        initials: "GODZ",
        name: "Big G",
        modelName: "Godzilla Premium",
      },
    ]);
    expect(initialsFor(machines, "bally")).toEqual(["PBM", "MAN"]);
    expect(initialsFor(machines, "1987")).toEqual(["MAN"]);
  });

  it("enforces the minimum query length and per-group result limit", () => {
    const machines = Array.from(
      { length: QUICK_SEARCH_RESULT_LIMIT + 2 },
      (_unused, index) =>
        machine(`M${String(index + 10)}`, `Machine ${String(index + 1)}`)
    );

    expect(matchQuickSearchMachines(machines, " M ")).toEqual([]);
    expect(matchQuickSearchMachines(machines, "machine")).toHaveLength(
      QUICK_SEARCH_RESULT_LIMIT
    );
  });

  it("normalizes whitespace the way the server does", () => {
    const machines = [machine("TZ", "Twilight Zone")];

    expect(initialsFor(machines, "  twilight   zone ")).toEqual(["TZ"]);
  });
});
