import { describe, expect, it } from "vitest";

import { formatLineupDate, syncReportWeekAt } from "./sync-report-schedule";

describe("syncReportWeekAt", () => {
  // Vercel fires the route at 23:00 UTC Monday and 00:00 UTC Tuesday; exactly
  // one of the two is 6 PM in Austin on any given week (spec §3.1).
  it.each([
    // Daylight time (CDT, UTC-5): the 23:00 UTC slot is 6 PM.
    ["2026-09-28T23:00:30Z", "2026-09-28"],
    ["2026-09-29T00:00:30Z", null],
    // Standard time (CST, UTC-6): the 00:00 UTC Tuesday slot is 6 PM Monday.
    ["2026-11-30T23:00:30Z", null],
    ["2026-12-01T00:00:30Z", "2026-11-30"],
    // The Monday after the November fall-back and after the March spring-forward.
    ["2026-11-03T00:00:00Z", "2026-11-02"],
    ["2027-03-15T23:00:00Z", "2027-03-15"],
    // A late delivery inside the hour still counts; the next hour does not.
    ["2026-09-28T23:59:59Z", "2026-09-28"],
    ["2026-09-29T01:00:00Z", null],
    // Another weekday at 6 PM Central.
    ["2026-09-29T23:00:00Z", null],
  ])("at %s returns %s", (iso, expected) => {
    expect(syncReportWeekAt(new Date(iso))).toBe(expected);
  });
});

describe("formatLineupDate", () => {
  it("formats the stored lineup's date in Central time", () => {
    // 03:00 UTC on the 29th is still the evening of the 28th in Austin.
    expect(formatLineupDate(new Date("2026-09-29T03:00:00Z"))).toBe(
      "Sep 28, 2026"
    );
  });
});
