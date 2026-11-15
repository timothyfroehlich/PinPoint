import { describe, expect, it } from "vitest";
import {
  parsePrintRunQuery,
  printRunInputs,
  printRunRowStatus,
  printRunRowsFromQuery,
  printRunStatusPrints,
  resolveRowSide,
  resolveSheetDefault,
  serializePrintRunQuery,
  sheetLabels,
  type PrintRunMachine,
  type PrintRunSet,
} from "~/lib/machines/settings-sheet-run";
import type { SettingsSection } from "~/lib/machines/settings-types";

function software(rows: [string, string][]): SettingsSection[] {
  return [
    {
      id: "sw",
      kind: "software",
      baseline: "3-ball",
      rows: rows.map(([id, value]) => ({ _key: id, id, name: id, value })),
    },
  ];
}

function set(id: string, overrides: Partial<PrintRunSet> = {}): PrintRunSet {
  return {
    id,
    name: id,
    updatedAt: "2026-09-12T00:00:00.000Z",
    isPreferredHouse: false,
    isPreferredTournament: false,
    tagSlugs: [],
    sections: [],
    ...overrides,
  };
}

const HOUSE = set("house", {
  isPreferredHouse: true,
  tagSlugs: ["house"],
  sections: software([["A.1 03", "4"]]),
});
const TOURNAMENT = set("tournament", {
  isPreferredTournament: true,
  tagSlugs: ["tournament"],
  sections: software([["A.1 03", "0"]]),
});

function machine(sets: PrintRunSet[], initials = "AFM"): PrintRunMachine {
  return { id: `id-${initials}`, initials, name: initials, sets };
}

const house = { kind: "house" } as const;
const tournament = { kind: "tournament" } as const;
const batCity = { kind: "tag", slug: "bat-city" } as const;

describe("resolveSheetDefault", () => {
  it("finds the preferred House and preferred Tournament sets", () => {
    const m = machine([HOUSE, TOURNAMENT]);
    expect(resolveSheetDefault(m, house, "from")).toEqual({
      kind: "set",
      setId: "house",
    });
    expect(resolveSheetDefault(m, tournament, "to")).toEqual({
      kind: "set",
      setId: "tournament",
    });
    expect(resolveSheetDefault(machine([HOUSE]), tournament, "to")).toEqual({
      kind: "none",
    });
  });

  it("prefers the side's preferred set when it carries the tag", () => {
    const tagged = { ...TOURNAMENT, tagSlugs: ["tournament", "bat-city"] };
    const other = set("other", { tagSlugs: ["bat-city"] });
    expect(
      resolveSheetDefault(machine([HOUSE, tagged, other]), batCity, "to")
    ).toEqual({ kind: "set", setId: "tournament" });
    // The From side's preferred set is House, which does not carry it.
    expect(
      resolveSheetDefault(machine([HOUSE, tagged, other]), batCity, "from")
    ).toEqual({ kind: "choose", setIds: ["tournament", "other"] });
  });

  it("finds the one tagged set, or asks between several", () => {
    const one = set("one", { tagSlugs: ["bat-city"] });
    const two = set("two", { tagSlugs: ["bat-city"] });
    expect(resolveSheetDefault(machine([HOUSE, one]), batCity, "to")).toEqual({
      kind: "set",
      setId: "one",
    });
    expect(
      resolveSheetDefault(machine([HOUSE, one, two]), batCity, "to")
    ).toEqual({ kind: "choose", setIds: ["one", "two"] });
    expect(resolveSheetDefault(machine([HOUSE]), batCity, "to")).toEqual({
      kind: "none",
    });
  });
});

describe("print run rows", () => {
  const m = machine([HOUSE, TOURNAMENT, set("extra")]);

  it("uses a hand-chosen set over the default", () => {
    expect(
      resolveRowSide(m, { machineId: m.id, to: "extra" }, "to", tournament)
    ).toEqual({ kind: "set", setId: "extra" });
    // A set the machine no longer has falls back to the default.
    expect(
      resolveRowSide(m, { machineId: m.id, to: "gone" }, "to", tournament)
    ).toEqual({ kind: "set", setId: "tournament" });
  });

  it("names what each row's block would print", () => {
    const options = { from: house, to: tournament };
    const row = { machineId: m.id };
    expect(printRunRowStatus(m, row, options)).toEqual({
      kind: "changes",
      count: 1,
    });
    expect(printRunRowStatus(m, { ...row, to: "house" }, options).kind).toBe(
      "same-set"
    );
    expect(printRunRowStatus(machine([TOURNAMENT]), row, options).kind).toBe(
      "no-from"
    );
    expect(printRunRowStatus(machine([HOUSE]), row, options).kind).toBe(
      "no-to"
    );
  });

  it("leaves a row needing a choice off the sheet", () => {
    const two = machine([
      HOUSE,
      set("one", { tagSlugs: ["bat-city"] }),
      set("two", { tagSlugs: ["bat-city"] }),
    ]);
    const options = { from: house, to: batCity };
    const status = printRunRowStatus(two, { machineId: two.id }, options);
    expect(status.kind).toBe("choose");
    expect(printRunStatusPrints(status, "full")).toBe(false);
    expect(printRunInputs([two], [{ machineId: two.id }], options)).toEqual([]);
  });

  it("prints a machine without changes only with full sets", () => {
    const status = { kind: "changes", count: 0 } as const;
    expect(printRunStatusPrints(status, "differences")).toBe(false);
    expect(printRunStatusPrints(status, "full")).toBe(true);
    expect(printRunStatusPrints({ kind: "no-to" }, "differences")).toBe(true);
  });
});

describe("print run URL", () => {
  it("round-trips the run, keeping only hand-chosen sets", () => {
    const afm = machine([HOUSE, TOURNAMENT, set("extra")], "AFM");
    const mm = machine([HOUSE, TOURNAMENT], "MM");
    const rows = [{ machineId: mm.id }, { machineId: afm.id, to: "extra" }];
    const options = {
      from: house,
      to: batCity,
      direction: "both",
      coverage: "full",
    } as const;
    const params = serializePrintRunQuery([afm, mm], rows, options);
    expect(params.get("m")).toBe("MM,AFM");
    expect(params.getAll("set")).toEqual(["AFM~~extra"]);

    const query = parsePrintRunQuery(Object.fromEntries(params));
    expect(query.options).toEqual(options);
    expect(printRunRowsFromQuery(query, [afm, mm])).toEqual(rows);
  });

  it("falls back to the defaults for missing or unknown values", () => {
    const query = parsePrintRunQuery({
      from: "nonsense",
      direction: "sideways",
      m: "afm, ,mm,AFM",
    });
    expect(query.options).toEqual({
      from: house,
      to: tournament,
      direction: "setup",
      coverage: "differences",
    });
    expect(query.initials).toEqual(["AFM", "MM"]);
  });
});

describe("sheetLabels", () => {
  it("names each side by its default", () => {
    expect(
      sheetLabels({ from: house, to: batCity }, [
        { slug: "bat-city", name: "Bat City 2025" },
      ])
    ).toEqual({
      fromDefault: "Default House",
      toDefault: "Tag: Bat City 2025",
      from: "House",
      to: "Bat City 2025",
    });
  });
});
