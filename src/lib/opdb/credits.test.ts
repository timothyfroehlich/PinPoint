import { describe, expect, it } from "vitest";

import { creditsFromPeople } from "./credits";

const person = (
  name: string,
  role: string,
  index: number,
  personId = index
): { name: string; role: string; index: number; personId: number } => ({
  name,
  role,
  index,
  personId,
});

describe("creditsFromPeople", () => {
  it("splits design and art in OPDB's index order", () => {
    // Funhouse, as OPDB lists it (2026-09-25).
    const credits = creditsFromPeople([
      person("John Youssi", "art", 2),
      person("Larry DeMar", "design", 1),
      person("Pat Lawlor", "design", 0),
      person("Chris Granner", "music", 3),
    ]);
    expect(credits).toEqual({
      design: ["Pat Lawlor", "Larry DeMar"],
      art: ["John Youssi"],
    });
  });

  it("keeps a person who holds both roles in each", () => {
    const credits = creditsFromPeople([
      person("Doug Watson", "design", 0),
      person("Doug Watson", "art", 1),
    ]);
    expect(credits).toEqual({ design: ["Doug Watson"], art: ["Doug Watson"] });
  });

  it("drops blank and repeated names within a role", () => {
    const credits = creditsFromPeople([
      person("Keith Elwin", "design", 0),
      person("  ", "design", 1),
      person("Keith Elwin", "design", 2, 99),
    ]);
    expect(credits.design).toEqual(["Keith Elwin"]);
    expect(credits.art).toEqual([]);
  });
});
