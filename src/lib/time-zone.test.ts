import { describe, expect, it } from "vitest";

import { siteDayOf, startOfNextSiteDay, startOfSiteDay } from "./time-zone";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Central DST transitions covered below:
 * - 2026-03-08 spring forward: 2:00 CST (08:00Z) becomes 3:00 CDT.
 * - 2026-11-01 fall back: 2:00 CDT (07:00Z) becomes 1:00 CST.
 */
describe("site-local day bounds (PP-qv6x)", () => {
  it.each([
    // [label, day, starts, next day starts, hours long]
    [
      "a daylight-time day",
      "2026-10-05",
      "2026-10-05T05:00:00.000Z",
      "2026-10-06T05:00:00.000Z",
      24,
    ],
    [
      "a standard-time day",
      "2026-01-15",
      "2026-01-15T06:00:00.000Z",
      "2026-01-16T06:00:00.000Z",
      24,
    ],
    [
      "the spring-forward day",
      "2026-03-08",
      "2026-03-08T06:00:00.000Z",
      "2026-03-09T05:00:00.000Z",
      23,
    ],
    [
      "the fall-back day",
      "2026-11-01",
      "2026-11-01T05:00:00.000Z",
      "2026-11-02T06:00:00.000Z",
      25,
    ],
    [
      "the last day of the year",
      "2026-12-31",
      "2026-12-31T06:00:00.000Z",
      "2027-01-01T06:00:00.000Z",
      24,
    ],
  ])("bounds %s on Central time", (_label, day, starts, ends, hours) => {
    const start = startOfSiteDay(day);
    const end = startOfNextSiteDay(day);
    expect(start.toISOString()).toBe(starts);
    expect(end.toISOString()).toBe(ends);
    expect((end.getTime() - start.getTime()) / HOUR_MS).toBe(hours);
  });

  it("rejects anything but a YYYY-MM-DD day", () => {
    expect(() => startOfSiteDay("2026-10-05T00:00:00Z")).toThrow(RangeError);
    expect(() => startOfNextSiteDay("Oct 5")).toThrow(RangeError);
  });
});

describe("siteDayOf (PP-4v3i)", () => {
  it.each([
    [
      "an evening already tomorrow in UTC",
      "2026-10-07T01:30:00.000Z",
      "2026-10-06",
    ],
    [
      "the first instant of a daylight-time day",
      "2026-10-07T05:00:00.000Z",
      "2026-10-07",
    ],
    [
      "the last instant of the fall-back day",
      "2026-11-02T05:59:59.999Z",
      "2026-11-01",
    ],
    [
      "the first instant after the fall-back day",
      "2026-11-02T06:00:00.000Z",
      "2026-11-02",
    ],
    [
      "the last instant of the spring-forward day",
      "2026-03-09T04:59:59.999Z",
      "2026-03-08",
    ],
    ["New Year's Eve evening", "2027-01-01T05:59:00.000Z", "2026-12-31"],
  ])("reads %s as the Central calendar day", (_label, iso, day) => {
    expect(siteDayOf(new Date(iso))).toBe(day);
    expect(siteDayOf(Date.parse(iso))).toBe(day);
  });

  it("round-trips with startOfSiteDay across the DST changes", () => {
    for (const day of ["2026-03-08", "2026-11-01", "2026-06-15"]) {
      expect(siteDayOf(startOfSiteDay(day))).toBe(day);
      expect(siteDayOf(startOfNextSiteDay(day).getTime() - 1)).toBe(day);
    }
  });
});
