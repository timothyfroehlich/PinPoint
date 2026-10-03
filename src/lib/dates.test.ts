import { subDays, subMonths } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatCompactAge,
  formatCompactAgeAgo,
  formatDate,
  formatDateTime,
  formatRelative,
  formatDayGroup,
  formatTimelineBucket,
} from "./dates";

describe("formatDayGroup", () => {
  it("returns 'Today' for a same-day timestamp", () => {
    expect(formatDayGroup(new Date())).toBe("Today");
  });

  it("returns 'Yesterday' for a timestamp from the prior calendar day", () => {
    expect(formatDayGroup(subDays(new Date(), 1))).toBe("Yesterday");
  });

  it("returns a weekday name for 2–6 calendar days back", () => {
    // 3 calendar days back lands inside the 2..6 weekday window. The exact
    // weekday depends on `today` and the label is locale-formatted, so derive
    // the expected value from the same Intl formatter rather than hard-coding
    // English names (which would fail under a non-English runtime locale).
    const date = subDays(new Date(), 3);
    const expected = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
    }).format(date);
    expect(formatDayGroup(date)).toBe(expected);
  });

  it("returns the absolute medium date for timestamps a week or older", () => {
    const date = subDays(new Date(), 14);
    expect(formatDayGroup(date)).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    );
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
    const date = subDays(new Date(), 3);
    const bucket = formatTimelineBucket(date);
    expect(bucket.tier).toBe("day");
    // Locale-formatted weekday — derive the expectation from the same Intl
    // formatter the implementation uses (see formatDayGroup test above).
    expect(bucket.label).toBe(
      new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)
    );
  });

  it("returns a month-tier bucket for timestamps 2 months back", () => {
    const date = subMonths(new Date(), 2);
    const bucket = formatTimelineBucket(date);
    expect(bucket.tier).toBe("month");
    expect(bucket.key.startsWith("month-")).toBe(true);
    expect(bucket.rowDateLabel).toBeDefined();
    // Label is a locale-formatted "month + year". Assert it contains the
    // 4-digit year rather than requiring the year to be the trailing token —
    // some locales are year-first.
    expect(bucket.label).toContain(String(date.getFullYear()));
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

describe("formatCompactAge", () => {
  const now = new Date("2026-06-09T12:00:00Z");

  it("returns 'now' under a minute and for future timestamps", () => {
    expect(formatCompactAge(new Date("2026-06-09T11:59:30Z"), now)).toBe("now");
    expect(formatCompactAge(new Date("2026-07-01T00:00:00Z"), now)).toBe("now");
  });

  it("returns minutes under an hour and hours under a day", () => {
    expect(formatCompactAge(new Date("2026-06-09T11:48:00Z"), now)).toBe("12m");
    expect(formatCompactAge(new Date("2026-06-09T09:00:00Z"), now)).toBe("3h");
    expect(formatCompactAge(new Date("2026-06-08T12:01:00Z"), now)).toBe("23h");
  });

  it("switches to days at exactly one day", () => {
    expect(formatCompactAge(new Date("2026-06-08T12:00:00Z"), now)).toBe("1d");
  });

  it("returns days only when under a month old", () => {
    expect(formatCompactAge(new Date("2026-06-04T12:00:00Z"), now)).toBe("5d");
  });

  it("returns months and days for multi-month ages", () => {
    // Jan 1 → Jun 9 is 5 months, 8 days (calendar-accurate).
    expect(formatCompactAge(new Date("2026-01-01T12:00:00Z"), now)).toBe(
      "5mo 8d"
    );
  });

  it("drops days once the age reaches a year", () => {
    expect(formatCompactAge(new Date("2024-12-09T12:00:00Z"), now)).toBe(
      "1y 6mo"
    );
  });
});

describe("formatCompactAgeAgo", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");

  it("formats compact service ages", () => {
    expect(formatCompactAgeAgo("2026-09-19T12:00:00.000Z", now)).toBe("2d ago");
    expect(formatCompactAgeAgo("2026-08-19T12:00:00.000Z", now)).toBe(
      "1mo 2d ago"
    );
    expect(formatCompactAgeAgo("2024-08-19T12:00:00.000Z", now)).toBe(
      "2y 1mo ago"
    );
    expect(formatCompactAgeAgo("2026-09-21T11:48:00.000Z", now)).toBe(
      "12m ago"
    );
    expect(formatCompactAgeAgo("2026-09-21T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatCompactAgeAgo(now, now)).toBe("just now");
  });
});

// Preserve normalization/options contracts in the formatter's canonical file.
// Intl is the external boundary; expected outputs do not call PinPoint helpers.
const FIXED_NOW = new Date("2026-04-18T12:00:00.000Z");
const FIXED_DATE = new Date("2026-01-15T08:30:00.000Z");
const INPUTS = [
  ["Date", FIXED_DATE],
  ["ISO string", "2026-01-15T08:30:00.000Z"],
  ["numeric timestamp", FIXED_DATE.getTime()],
] as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("date formatter input and presentation contracts", () => {
  it.each(INPUTS)(
    "formats %s as medium date and medium date with short time",
    (_label, input) => {
      expect(formatDate(input)).toBe(
        new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
          FIXED_DATE
        )
      );
      expect(formatDateTime(input)).toBe(
        new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(FIXED_DATE)
      );
    }
  );

  it.each([
    ["Date", new Date("2026-04-18T11:00:00.000Z")],
    ["ISO string", "2026-04-18T11:00:00.000Z"],
    ["numeric timestamp", FIXED_NOW.getTime() - 60 * 60 * 1000],
  ] as const)("formats a past %s with the relative suffix", (_label, input) => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    expect(formatRelative(input)).toBe("about 1 hour ago");
  });

  it.each([null, undefined])("rejects nullish runtime input %s", (input) => {
    expect(() => Reflect.apply(formatDateTime, undefined, [input])).toThrow(
      new TypeError("Expected date to be a Date, string, or number")
    );
  });
});
