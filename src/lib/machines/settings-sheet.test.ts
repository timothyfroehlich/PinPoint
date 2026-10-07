import { describe, expect, it } from "vitest";
import {
  buildSettingsSheet,
  compareMachine,
  parseSheetCoverage,
  parseSheetDirection,
  type SheetMachineInput,
  type SheetSetInput,
} from "~/lib/machines/settings-sheet";
import type { SettingsSection } from "~/lib/machines/settings-types";
import { plainTextToDoc } from "~/lib/tiptap/types";

function software(
  baseline: string,
  rows: [id: string, name: string, value: string][]
): SettingsSection {
  return {
    id: `sw-${baseline}`,
    kind: "software",
    baseline,
    rows: rows.map(([id, name, value]) => ({ _key: id, id, name, value })),
  };
}

function note(title: string, text: string): SettingsSection {
  return {
    id: `note-${title}`,
    kind: "note",
    title,
    body: plainTextToDoc(text),
    customTitle: false,
  };
}

function set(name: string, sections: SettingsSection[]): SheetSetInput {
  return { name, updatedAt: "2026-09-12", sections };
}

function machine(
  overrides: Partial<SheetMachineInput> & Pick<SheetMachineInput, "name">
): SheetMachineInput {
  return {
    id: overrides.name,
    initials: overrides.name.slice(0, 3).toUpperCase(),
    from: null,
    to: null,
    ...overrides,
  };
}

const afm = machine({
  name: "Attack from Mars",
  from: set("House", [
    software("3-ball", [
      ["A.1 01", "Balls per game", "3"],
      ["A.1 03", "Max extra balls", "4"],
    ]),
  ]),
  to: set("League", [
    software("3-ball", [
      ["A.1 01", "Balls per game", "3"],
      ["A.1 03", "Maximum extra balls", "0"],
    ]),
  ]),
});

describe("buildSettingsSheet", () => {
  it("lists only differences, matched by setting ID, with differences only", () => {
    const sheet = buildSettingsSheet([afm], "differences");
    expect(sheet.machines[0]?.rows).toEqual([
      {
        location: "A.1 03",
        name: "Maximum extra balls",
        from: { kind: "value", text: "4" },
        to: { kind: "value", text: "0" },
        differs: true,
      },
    ]);
    expect(sheet.machines[0]?.reinstall).toBeNull();
  });

  it("lists matching rows too with full sets, marking which differ", () => {
    const sheet = buildSettingsSheet([afm], "full");
    expect(sheet.machines[0]?.rows.map((r) => [r.location, r.differs])).toEqual(
      [
        ["A.1 01", false],
        ["A.1 03", true],
      ]
    );
  });

  it("lists a machine with no differences on one line, or as a block with full sets", () => {
    const same = machine({
      name: "Twilight Zone",
      from: afm.from,
      to: afm.from,
    });
    const diff = buildSettingsSheet([same], "differences");
    expect(diff.machines).toEqual([]);
    expect(diff.unchanged).toEqual([
      { name: "Twilight Zone", initials: "TWI" },
    ]);

    const full = buildSettingsSheet([same], "full");
    expect(full.unchanged).toEqual([]);
    expect(full.machines[0]?.rows.every((r) => !r.differs)).toBe(true);
  });

  it("orders machines by name", () => {
    const sheet = buildSettingsSheet(
      [
        machine({ name: "Twilight Zone" }),
        machine({ name: "attack from Mars" }),
        machine({ name: "Medieval Madness" }),
      ],
      "full"
    );
    expect(sheet.machines.map((m) => m.name)).toEqual([
      "attack from Mars",
      "Medieval Madness",
      "Twilight Zone",
    ]);
  });
});

describe("compareMachine", () => {
  it("falls back to the row name when a row has no ID", () => {
    const result = compareMachine(
      machine({
        name: "Fathom",
        from: set("D", [software("", [["", "Ball save", "On"]])]),
        to: set("T", [software("", [["", "ball save ", "Off"]])]),
      })
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.from).toEqual({ kind: "value", text: "On" });
  });

  it("names the install for a software row only one set lists", () => {
    const result = compareMachine(
      machine({
        name: "Medieval Madness",
        from: set("House", [software("Medium", [])]),
        to: set("Tournament", [
          software("Medium", [["A.2 13", "Castle difficulty", "Hard"]]),
        ]),
      })
    );
    expect(result.rows[0]?.from).toEqual({
      kind: "install",
      install: "Medium",
    });
    expect(result.rows[0]?.differs).toBe(true);
  });

  it("compares DIP switches per bank and switch", () => {
    const dip = (on: boolean): SettingsSection => ({
      id: "dip",
      kind: "dip",
      name: "Bank 1",
      switches: [
        { _key: "1", switch: "SW 1", position: "ON", note: "Coin chute" },
        {
          _key: "7",
          switch: "SW 7",
          position: on ? "ON" : "OFF",
          note: "Extra ball award",
        },
      ],
    });
    const result = compareMachine(
      machine({
        name: "Eight Ball Deluxe",
        from: set("House", [dip(true)]),
        to: set("Tournament", [dip(false)]),
      })
    );
    expect(result.rows.filter((r) => r.differs)).toEqual([
      {
        location: "SW 7",
        name: "Extra ball award",
        from: { kind: "value", text: "ON" },
        to: { kind: "value", text: "OFF" },
        differs: true,
      },
    ]);
  });

  it("marks a table row only one set lists as not recorded, not an install", () => {
    const result = compareMachine(
      machine({
        name: "Humpty Dumpty",
        from: set("House", [software("3-ball", [])]),
        to: set("Tournament", [
          software("3-ball", []),
          {
            id: "t",
            kind: "table",
            title: "Jones plugs",
            rows: [{ _key: "j3", id: "J3", name: "Balls", value: "3-ball" }],
          },
        ]),
      })
    );
    expect(result.rows[0]?.from).toEqual({ kind: "not-recorded" });
  });

  it("compares notes as whole text", () => {
    const result = compareMachine(
      machine({
        name: "Medieval Madness",
        from: set("House", [
          note("Rubbers", "White, factory sizes"),
          note("Post positions", "Factory"),
        ]),
        to: set("Tournament", [
          note("Rubbers", "White, factory sizes"),
          note("Post positions", "Lower sling post in the bottom hole"),
        ]),
      })
    );
    expect(result.notes.map((n) => [n.title, n.differs])).toEqual([
      ["Rubbers", false],
      ["Post positions", true],
    ]);
  });

  it("lists every software row of each set when the installs differ", () => {
    const result = compareMachine(
      machine({
        name: "Godzilla",
        from: set("House", [
          software("Factory Install", [
            ["S-14", "Game pricing", "Free play"],
            ["S-31", "Tilt warnings", "3"],
          ]),
        ]),
        to: set("Competition", [
          software("Competition Install", [
            ["S-14", "Game pricing", "Free play"],
            ["S-08", "Ball save time", "3 s"],
          ]),
        ]),
      })
    );
    expect(result.rows).toEqual([]);
    expect(result.reinstall?.toInstall).toBe("Competition Install");
    expect(result.reinstall?.fromInstall).toBe("Factory Install");
    expect(
      result.reinstall?.toRows.map((r) => [r.location, r.differs])
    ).toEqual([
      ["S-14", false],
      ["S-08", true],
    ]);
    expect(result.reinstall?.fromRows.map((r) => r.location)).toEqual([
      "S-14",
      "S-31",
    ]);
  });

  it("prints a record block when there is no From set", () => {
    const result = compareMachine(
      machine({
        name: "Foo Fighters",
        to: set("League", [
          software("Factory Install", [["S-08", "Ball save time", "0 s"]]),
          note("Rubbers", "Black"),
        ]),
      })
    );
    expect(result.kind).toBe("record");
    expect(result.rows).toEqual([
      {
        location: "S-08",
        name: "Ball save time",
        from: { kind: "not-recorded" },
        to: { kind: "value", text: "0 s" },
        differs: true,
      },
    ]);
    expect(result.notes).toHaveLength(1);
  });

  it("prints a blank block when there is no To set", () => {
    const result = compareMachine(
      machine({ name: "Jaws", from: set("House", [software("F", [])]) })
    );
    expect(result.kind).toBe("blank");
    expect(result.rows).toEqual([]);
    expect(result.fromSet?.name).toBe("House");
  });
});

describe("parsers", () => {
  it("default to set up and differences only", () => {
    expect(parseSheetDirection("restore")).toBe("restore");
    expect(parseSheetDirection("nonsense")).toBe("setup");
    expect(parseSheetCoverage("full")).toBe("full");
    expect(parseSheetCoverage(undefined)).toBe("differences");
  });
});
