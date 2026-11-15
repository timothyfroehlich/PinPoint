import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatCompactAge,
  formatCalendarDay,
  formatCompactAgeAgo,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatRelative,
  formatTimelineBucket,
  isSiteToday,
} from "./dates";

// Fixtures on Central time (America/Chicago):
// - EVENING_NOW is 8:30 PM CDT on Tuesday, Oct 6 — already Oct 7 in UTC, so
//   a UTC-day implementation files it (and everything after 7 PM) a day late.
// - 2026-03-08 springs forward (2:00 CST → 3:00 CDT, 08:00Z); 2026-11-01
//   falls back (2:00 CDT → 1:00 CST, 07:00Z).
const EVENING_NOW = new Date("2026-10-07T01:30:00.000Z");

describe("formatCalendarDay", () => {
  it.each([
    ["a bare day", "2026-10-04", "Oct 4, 2026"],
    // iScored's venue-local wall time: an after-midnight score stays on its
    // own day instead of sliding back through a zone conversion.
    [
      "an iScored after-midnight timestamp",
      "2026-10-04 00:30:00",
      "Oct 4, 2026",
    ],
    ["an iScored evening timestamp", "2026-10-04 21:34:46", "Oct 4, 2026"],
    ["a fall-back day", "2026-11-01", "Nov 1, 2026"],
  ])("prints %s as written", (_label, value, expected) => {
    expect(formatCalendarDay(value)).toBe(expected);
  });

  it.each(["", "Oct 4", "2026-02-30", "2026-10-041", "not a date"])(
    "returns null for %j",
    (value) => {
      expect(formatCalendarDay(value)).toBeNull();
    }
  );
});

describe("isSiteToday", () => {
  it.each([
    ["the site day's first instant", "2026-10-06T05:00:00.000Z", true],
    ["a UTC-tomorrow evening event", "2026-10-07T00:30:00.000Z", true],
    ["the site day's last instant", "2026-10-07T04:59:59.999Z", true],
    ["the previous site day's last instant", "2026-10-06T04:59:59.999Z", false],
    ["the next site day's first instant", "2026-10-07T05:00:00.000Z", false],
  ])("reads %s on Central time", (_label, iso, expected) => {
    expect(isSiteToday(iso, EVENING_NOW)).toBe(expected);
  });
});

describe("formatTimelineBucket", () => {
  it.each([
    ["this morning", "2026-10-06T14:00:00.000Z", "day-2026-10-06", "Today"],
    ["this evening", "2026-10-07T00:30:00.000Z", "day-2026-10-06", "Today"],
    ["last night", "2026-10-06T03:00:00.000Z", "day-2026-10-05", "Yesterday"],
    ["3 days back", "2026-10-03T15:00:00.000Z", "day-2026-10-03", "Saturday"],
    ["6 days back", "2026-09-30T15:00:00.000Z", "day-2026-09-30", "Wednesday"],
  ])(
    "buckets %s by the site day at an evening-Central now",
    (_label, iso, key, label) => {
      expect(formatTimelineBucket(iso, EVENING_NOW)).toEqual({
        key,
        label,
        tier: "day",
      });
    }
  );

  it("rolls a week or older into the site month, with the site date as its chip", () => {
    // 10:00 PM CDT on Jul 31 — Aug 1 in UTC.
    expect(
      formatTimelineBucket("2026-08-01T03:00:00.000Z", EVENING_NOW)
    ).toEqual({
      key: "month-2026-07",
      label: "July 2026",
      tier: "month",
      rowDateLabel: "Jul 31",
    });
    expect(
      formatTimelineBucket("2026-09-29T15:00:00.000Z", EVENING_NOW).tier
    ).toBe("month");
  });

  it.each([
    // [label, event, now, expected label]
    [
      "the fall-back change",
      "2026-11-01T04:30:00.000Z", // Oct 31, 11:30 PM CDT
      "2026-11-02T05:30:00.000Z", // Nov 1, 11:30 PM CST (25 h later)
      "Yesterday",
    ],
    [
      "the spring-forward change",
      "2026-03-08T05:30:00.000Z", // Mar 7, 11:30 PM CST
      "2026-03-09T04:30:00.000Z", // Mar 8, 11:30 PM CDT (23 h later)
      "Yesterday",
    ],
    [
      "two days across the fall-back change",
      "2026-10-31T04:30:00.000Z", // Fri Oct 30, 11:30 PM CDT
      "2026-11-02T04:30:00.000Z", // Sun Nov 1, 10:30 PM CST
      "Friday",
    ],
  ])("counts calendar days across %s", (_label, iso, now, label) => {
    expect(formatTimelineBucket(iso, new Date(now)).label).toBe(label);
  });

  it("keeps both 1:30 AMs of the fall-back day in one bucket", () => {
    const now = new Date("2026-11-01T20:00:00.000Z");
    const cdt = formatTimelineBucket("2026-11-01T06:30:00.000Z", now);
    const cst = formatTimelineBucket("2026-11-01T07:30:00.000Z", now);
    expect(cdt).toEqual({ key: "day-2026-11-01", label: "Today", tier: "day" });
    expect(cst).toEqual(cdt);
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
      // 08:30Z is 2:30 AM CST.
      expect(formatDate(input)).toBe("Jan 15, 2026");
      expect(formatDateTime(input)).toBe("Jan 15, 2026, 2:30 AM");
    }
  );

  it.each([
    // [label, instant, date, date and time]
    [
      "an evening-Central instant",
      "2026-10-07T01:30:00.000Z",
      "Oct 6, 2026",
      "Oct 6, 2026, 8:30 PM",
    ],
    [
      "the last minute of a standard-time day",
      "2026-11-02T05:59:00.000Z",
      "Nov 1, 2026",
      "Nov 1, 2026, 11:59 PM",
    ],
    [
      "the hour after springing forward",
      "2026-03-08T08:30:00.000Z",
      "Mar 8, 2026",
      "Mar 8, 2026, 3:30 AM",
    ],
    [
      "the first 1:30 AM of the fall-back day",
      "2026-11-01T06:30:00.000Z",
      "Nov 1, 2026",
      "Nov 1, 2026, 1:30 AM",
    ],
    [
      "the second 1:30 AM of the fall-back day",
      "2026-11-01T07:30:00.000Z",
      "Nov 1, 2026",
      "Nov 1, 2026, 1:30 AM",
    ],
  ])("formats %s on the site clock", (_label, iso, date, dateTime) => {
    expect(formatDate(iso)).toBe(date);
    expect(formatDateTime(iso)).toBe(dateTime);
  });

  it("formats the month and year on the site calendar", () => {
    // 8:00 PM CDT on Sep 30 — Oct 1 in UTC.
    expect(formatMonthYear("2026-10-01T01:00:00.000Z")).toBe("Sep 2026");
    expect(formatMonthYear(FIXED_DATE)).toBe("Jan 2026");
  });

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
