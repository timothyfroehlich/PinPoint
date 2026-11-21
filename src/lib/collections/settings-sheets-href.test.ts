import { describe, expect, it } from "vitest";
import { parsePrintRunQuery } from "~/lib/machines/settings-sheet-run";
import { groupSettingsSheetsHref } from "./settings-sheets-href";

describe("groupSettingsSheetsHref (settings-sheets §2.6)", () => {
  it("adds only the group's machines On the Floor", () => {
    const href = groupSettingsSheetsHref([
      { initials: "AFM", presenceStatus: "on_the_floor" },
      { initials: "TZ", presenceStatus: "off_the_floor" },
      { initials: "MM", presenceStatus: "on_the_floor" },
    ]);
    const url = new URL(href, "https://example.test");
    expect(url.pathname).toBe("/m/settings-sheets");
    expect(
      parsePrintRunQuery(Object.fromEntries(url.searchParams)).initials
    ).toEqual(["AFM", "MM"]);
  });
});
