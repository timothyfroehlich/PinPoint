import { describe, expect, it } from "vitest";
import { machineLevelOpdbId, parseOpdbEntry, parseOpdbExport } from "./parse";

const funhouse = {
  opdbId: "G5Dz7-Mq139",
  name: "Funhouse",
  type: "ss",
  display: "alphanumeric",
  playerCount: 4,
  people: [
    { opdbPersonId: 9, name: "Larry DeMar", role: "design", index: 1 },
    { opdbPersonId: 10, name: "Pat Lawlor", role: "design", index: 0 },
  ],
};

describe("parseOpdbEntry", () => {
  it("keeps a machine entry with credits in OPDB's order", () => {
    expect(parseOpdbEntry(funhouse)).toEqual({
      opdbId: "G5Dz7-Mq139",
      name: "Funhouse",
      type: "ss",
      display: "alphanumeric",
      playerCount: 4,
      people: [
        { personId: 10, name: "Pat Lawlor", role: "design", index: 0 },
        { personId: 9, name: "Larry DeMar", role: "design", index: 1 },
      ],
    });
  });

  it("keeps alias entries", () => {
    expect(
      parseOpdbEntry({ ...funhouse, opdbId: "GweeP-Ml9pZ-ARZoY" })?.opdbId
    ).toBe("GweeP-Ml9pZ-ARZoY");
  });

  it("skips group-only entries and malformed IDs", () => {
    expect(parseOpdbEntry({ ...funhouse, opdbId: "G5Dz7" })).toBeNull();
    expect(parseOpdbEntry({ ...funhouse, opdbId: "not-an-id" })).toBeNull();
    expect(parseOpdbEntry({ ...funhouse, name: 7 })).toBeNull();
    expect(parseOpdbEntry(null)).toBeNull();
  });

  it("turns values outside OPDB's vocabulary into null", () => {
    const parsed = parseOpdbEntry({
      ...funhouse,
      type: "hybrid",
      display: "hologram",
      playerCount: 0,
    });
    expect(parsed).toMatchObject({
      type: null,
      display: null,
      playerCount: null,
    });
  });

  it("drops malformed credits and tolerates a missing people list", () => {
    expect(
      parseOpdbEntry({
        ...funhouse,
        people: [{ name: "No Id", role: "art", index: 0 }, "junk"],
      })?.people
    ).toEqual([]);
    expect(parseOpdbEntry({ ...funhouse, people: undefined })?.people).toEqual(
      []
    );
  });
});

describe("parseOpdbExport", () => {
  it("parses the entries array and skips unusable entries", () => {
    expect(
      parseOpdbExport({ entries: [funhouse, { opdbId: "G5Dz7", name: "x" }] })
    ).toHaveLength(1);
  });

  it("throws on a payload that is not the export", () => {
    expect(() => parseOpdbExport({ machines: [] })).toThrow(/entries/);
    expect(() => parseOpdbExport([funhouse])).toThrow(/entries/);
  });
});

describe("machineLevelOpdbId", () => {
  it("strips the alias part only", () => {
    expect(machineLevelOpdbId("GweeP-Ml9pZ-ARZoY")).toBe("GweeP-Ml9pZ");
    expect(machineLevelOpdbId("G5Dz7-Mq139")).toBe("G5Dz7-Mq139");
    expect(machineLevelOpdbId("G5Dz7")).toBe("G5Dz7");
  });
});
