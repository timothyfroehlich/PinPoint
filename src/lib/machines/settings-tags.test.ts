import { describe, expect, it } from "vitest";

import {
  compareSettingsTags,
  setsOnMachinesPhrase,
  settingsTagPrintHref,
  undecidedSetCount,
} from "~/lib/machines/settings-tags";
import { parsePrintRunQuery } from "~/lib/machines/settings-sheet-run";

describe("setsOnMachinesPhrase", () => {
  it.each([
    [0, 0, "No sets"],
    [1, 1, "1 set on 1 machine"],
    [2, 1, "2 sets on 1 machine"],
    [8, 7, "8 sets on 7 machines"],
  ])("%i sets on %i machines reads %s", (sets, machines, expected) => {
    expect(setsOnMachinesPhrase(sets, machines)).toBe(expected);
  });
});

describe("compareSettingsTags (machine-settings §3.7)", () => {
  it("puts House and Tournament first, then the rest by name", () => {
    const tags = [
      { slug: "kids-night", name: "Kids night" },
      { slug: "tournament", name: "Tournament" },
      { slug: "bat-city", name: "Bat City 2025" },
      { slug: "house", name: "House" },
    ];
    expect([...tags].sort(compareSettingsTags).map((t) => t.name)).toEqual([
      "House",
      "Tournament",
      "Bat City 2025",
      "Kids night",
    ]);
  });
});

describe("undecidedSetCount (settings-sheets §6.3)", () => {
  const plain = { isPreferredHouse: false, isPreferredTournament: false };
  const defaultTournament = { ...plain, isPreferredTournament: true };
  const defaultHouse = { ...plain, isPreferredHouse: true };

  it("counts two or more tagged sets with no default for the To side", () => {
    expect(undecidedSetCount("bat-city", [plain, plain])).toBe(2);
    expect(undecidedSetCount("bat-city", [plain, plain, plain])).toBe(3);
  });

  it("is settled by a single set or by the default Tournament set", () => {
    expect(undecidedSetCount("bat-city", [plain])).toBe(0);
    expect(undecidedSetCount("bat-city", [plain, defaultTournament])).toBe(0);
  });

  it("a default House set does not settle a custom tag", () => {
    expect(undecidedSetCount("bat-city", [plain, defaultHouse])).toBe(2);
  });

  it("a built-in tag is settled by its own default set", () => {
    expect(undecidedSetCount("house", [plain, defaultHouse])).toBe(0);
    expect(undecidedSetCount("house", [plain, defaultTournament])).toBe(2);
  });
});

describe("settingsTagPrintHref (settings-sheets §2.6)", () => {
  const machines = [
    { initials: "MM", onTheFloor: true },
    { initials: "SM", onTheFloor: false },
    { initials: "HD", onTheFloor: true },
  ];

  function parsed(href: string): ReturnType<typeof parsePrintRunQuery> {
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/m/settings-sheets");
    return parsePrintRunQuery(Object.fromEntries(url.searchParams));
  }

  it("adds the machines On the Floor and makes the tag the To starting set", () => {
    const query = parsed(settingsTagPrintHref("bat-city-2025", machines));
    expect(query.initials).toEqual(["MM", "HD"]);
    expect(query.options.to).toEqual({ kind: "tag", slug: "bat-city-2025" });
    expect(query.options.from).toEqual({ kind: "house" });
  });

  it("starts a built-in tag from its default set", () => {
    expect(
      parsed(settingsTagPrintHref("tournament", machines)).options.to
    ).toEqual({ kind: "tournament" });
  });
});
