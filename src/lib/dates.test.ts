import { subDays, subMonths } from "date-fns";
import { describe, expect, it } from "vitest";

import { formatDayGroup, formatTimelineBucket } from "./dates";

describe("formatDayGroup", () => {
  it("returns 'Today' for a same-day timestamp", () => {
    expect(formatDayGroup(new Date())).toBe("Today");
  });

  it("returns 'Yesterday' for a timestamp from the prior calendar day", () => {
    expect(formatDayGroup(subDays(new Date(), 1))).toBe("Yesterday");
  });

  it("returns a weekday name for 2–6 calendar days back", () => {
    // 3 calendar days back lands inside the 2..6 weekday window. We can't
    // assert a specific weekday (it depends on `today`), but it must be one
    // of the seven English weekday names that `weekday: "long"` produces.
    const label = formatDayGroup(subDays(new Date(), 3));
    const weekdays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    expect(weekdays).toContain(label);
  });

  it("returns the absolute medium date for timestamps a week or older", () => {
    const label = formatDayGroup(subDays(new Date(), 14));
    expect(label).not.toBe("Today");
    expect(label).not.toBe("Yesterday");
    // Two-week-back dates fall outside the 2..6 weekday window, so the
    // label must NOT be a weekday name.
    const weekdays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    expect(weekdays).not.toContain(label);
    expect(label.length).toBeGreaterThan(0);
  });
});

describe("formatTimelineBucket", () => {
  it("returns a day-tier bucket for today", () => {
    const bucket = formatTimelineBucket(new Date());
    expect(bucket.tier).toBe("day");
    expect(bucket.label).toBe("Today");
    expect(bucket.key.startsWith("day-")).toBe(true);
    expect(bucket.rowDateLabel).toBeUndefined();
  });

  it("returns a day-tier bucket for yesterday", () => {
    const bucket = formatTimelineBucket(subDays(new Date(), 1));
    expect(bucket.tier).toBe("day");
    expect(bucket.label).toBe("Yesterday");
  });

  it("returns a day-tier bucket with a weekday label for 3 days back", () => {
    const bucket = formatTimelineBucket(subDays(new Date(), 3));
    expect(bucket.tier).toBe("day");
    expect([
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]).toContain(bucket.label);
  });

  it("returns a month-tier bucket for timestamps 2 months back", () => {
    const bucket = formatTimelineBucket(subMonths(new Date(), 2));
    expect(bucket.tier).toBe("month");
    expect(bucket.key.startsWith("month-")).toBe(true);
    expect(bucket.rowDateLabel).toBeDefined();
    // Label has the form "Month YYYY" — verify the trailing year.
    expect(bucket.label).toMatch(/\d{4}$/);
  });

  it("two same-day timestamps share a bucket key", () => {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    const evening = new Date();
    evening.setHours(20, 0, 0, 0);
    expect(formatTimelineBucket(morning).key).toBe(
      formatTimelineBucket(evening).key
    );
  });

  it("two different-day timestamps in the same month share a month-tier key", () => {
    const a = subMonths(new Date(), 3);
    const b = new Date(a);
    b.setDate(a.getDate() === 1 ? 28 : 1);
    const bucketA = formatTimelineBucket(a);
    const bucketB = formatTimelineBucket(b);
    expect(bucketA.tier).toBe("month");
    expect(bucketB.tier).toBe("month");
    expect(bucketA.key).toBe(bucketB.key);
    // But each row gets its own date chip.
    expect(bucketA.rowDateLabel).not.toBe(bucketB.rowDateLabel);
  });
});
