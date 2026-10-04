import { describe, expect, it } from "vitest";

import {
  formatSummaryPeriod,
  previousScheduledPostInstant,
  scheduledPeriodStart,
  scheduledPostInstant,
} from "./schedule";

const at = (iso: string): Date => new Date(iso);
const iso = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

/**
 * Central DST transitions covered below:
 * - 2026-03-08 spring forward: 2:00 CST (08:00Z) becomes 3:00 CDT.
 * - 2026-11-01 fall back: 1:00 CDT (06:00Z) and 1:00 CST (07:00Z).
 * - 2027-03-14 spring forward: 2:00 CST (08:00Z) becomes 3:00 CDT.
 * - 2027-11-07 fall back: 1:00 CDT (06:00Z) and 1:00 CST (07:00Z).
 */
describe("scheduledPostInstant (§3.1, §3.4)", () => {
  it.each([
    // [label, now, interval, start hour, expected post instant]
    [
      "daily 6 PM in daylight time",
      "2026-10-03T23:10:00Z",
      24,
      18,
      "2026-10-03T23:00:00.000Z",
    ],
    [
      "daily 6 PM in standard time",
      "2026-12-02T00:59:00Z",
      24,
      18,
      "2026-12-02T00:00:00.000Z",
    ],
    ["daily 6 PM, the 7 PM run", "2026-10-04T00:00:00Z", 24, 18, null],
    [
      "daily, the day after spring forward 2026",
      "2026-03-08T23:05:00Z",
      24,
      18,
      "2026-03-08T23:00:00.000Z",
    ],
    [
      "daily, the day of fall back 2027",
      "2027-11-08T00:05:00Z",
      24,
      18,
      "2027-11-08T00:00:00.000Z",
    ],
    [
      "every 4 hours from 2 AM, at 10 PM",
      "2026-10-04T03:00:00Z",
      4,
      2,
      "2026-10-04T03:00:00.000Z",
    ],
    ["every 4 hours from 2 AM, at 11 PM", "2026-10-04T04:00:00Z", 4, 2, null],
    [
      "hourly, any hour",
      "2027-07-01T17:42:00Z",
      1,
      18,
      "2027-07-01T17:00:00.000Z",
    ],
  ] as const)("%s", (_label, now, interval, startHour, expected) => {
    expect(iso(scheduledPostInstant(at(now), interval, startHour))).toBe(
      expected
    );
  });

  it.each([
    ["2026", "2026-11-01"],
    ["2027", "2027-11-07"],
  ])(
    "gives both runs of the repeated fall-back hour one instant (%s)",
    (_year, day) => {
      const firstRun = at(`${day}T06:00:00Z`); // 1:00 CDT
      const secondRun = at(`${day}T07:00:00Z`); // 1:00 CST
      for (const interval of [1, 4, 24]) {
        const first = scheduledPostInstant(firstRun, interval, 1);
        expect(iso(first)).toBe(`${day}T06:00:00.000Z`);
        expect(iso(scheduledPostInstant(secondRun, interval, 1))).toBe(
          iso(first)
        );
      }
    }
  );

  it.each([
    ["2026", "2026-03-08"],
    ["2027", "2027-03-14"],
  ])(
    "never reaches the spring-forward hour that does not exist (%s)",
    (_year, day) => {
      // The run at 08:00Z reads 3 AM CDT, never 2 AM.
      const run = at(`${day}T08:00:00Z`);
      for (const interval of [1, 4, 24]) {
        const instant = scheduledPostInstant(run, interval, 2);
        if (interval === 1) expect(iso(instant)).toBe(`${day}T08:00:00.000Z`);
        else expect(instant).toBeNull();
      }
    }
  );
});

describe("previousScheduledPostInstant (§3.3, §3.4)", () => {
  it.each([
    // [label, post instant, interval, previous]
    [
      "daily across spring forward 2026 (23-hour day)",
      "2026-03-08T23:00:00Z",
      24,
      "2026-03-08T00:00:00.000Z",
    ],
    [
      "daily across fall back 2026 (25-hour day)",
      "2026-11-02T00:00:00Z",
      24,
      "2026-10-31T23:00:00.000Z",
    ],
    [
      "daily across spring forward 2027",
      "2027-03-14T23:00:00Z",
      24,
      "2027-03-14T00:00:00.000Z",
    ],
    [
      "daily across fall back 2027",
      "2027-11-08T00:00:00Z",
      24,
      "2027-11-06T23:00:00.000Z",
    ],
    // 3 AM CDT → the 2 AM that does not exist → 1 AM CST.
    [
      "hourly past the missing hour 2026",
      "2026-03-08T08:00:00Z",
      1,
      "2026-03-08T07:00:00.000Z",
    ],
    // 2 AM CST → 1 AM, whose first occurrence is 1 AM CDT.
    [
      "hourly past the repeated hour 2026",
      "2026-11-01T08:00:00Z",
      1,
      "2026-11-01T06:00:00.000Z",
    ],
    [
      "hourly past the repeated hour 2027",
      "2027-11-07T08:00:00Z",
      1,
      "2027-11-07T06:00:00.000Z",
    ],
    // 6 AM CDT → the 2 AM that does not exist → 10 PM CST the night before.
    [
      "every 4 hours past the missing post time 2027",
      "2027-03-14T11:00:00Z",
      4,
      "2027-03-14T04:00:00.000Z",
    ],
    // 5 AM CST → 1 AM, first occurrence.
    [
      "every 4 hours past the repeated post time 2027",
      "2027-11-07T11:00:00Z",
      4,
      "2027-11-07T06:00:00.000Z",
    ],
  ] as const)("%s", (_label, post, interval, expected) => {
    expect(iso(previousScheduledPostInstant(at(post), interval))).toBe(
      expected
    );
  });
});

describe("scheduledPeriodStart (§3.2, §3.3)", () => {
  const post = at("2026-10-03T23:00:00Z");
  const previous = "2026-10-02T23:00:00.000Z";

  it.each([
    [
      "starts at the previous post time with no previous period",
      null,
      previous,
    ],
    ["continues from the last period's end", "2026-10-02T23:00:00Z", previous],
    [
      "continues from a Send summary now inside the interval",
      "2026-10-03T15:37:12Z",
      "2026-10-03T15:37:12.000Z",
    ],
    [
      "starts at the previous post time when the last period ended before it",
      "2026-09-20T23:00:00Z",
      previous,
    ],
  ] as const)("%s", (_label, lastEnd, expected) => {
    expect(
      scheduledPeriodStart(
        post,
        24,
        lastEnd === null ? null : at(lastEnd)
      ).toISOString()
    ).toBe(expected);
  });
});

describe("formatSummaryPeriod (§6.1)", () => {
  it("names both dates across days, in Central time", () => {
    expect(
      formatSummaryPeriod(
        at("2026-10-02T23:00:00Z"),
        at("2026-10-03T23:00:00Z")
      )
    ).toBe("Oct 2, 6:00 PM to Oct 3, 6:00 PM");
  });

  it("drops the repeated date within one day", () => {
    expect(
      formatSummaryPeriod(
        at("2026-10-03T19:00:00Z"),
        at("2026-10-03T23:00:00Z")
      )
    ).toBe("Oct 3, 2:00 PM to 6:00 PM");
  });
});
