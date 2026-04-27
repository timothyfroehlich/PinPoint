import { describe, it, expect, vi, afterEach } from "vitest";
import { formatRelative, formatDate, formatDateTime } from "~/lib/dates";

// Fixed points in time so fake-timer assertions stay deterministic.
const FIXED_NOW = new Date("2026-04-18T12:00:00.000Z");
const FIXED_DATE = new Date("2026-01-15T08:30:00.000Z");

// Restore real timers after every test so a failed assertion inside a
// fake-timer block never leaks state into the next test.
afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelative", () => {
  it("accepts a Date object and returns a string with 'ago' suffix", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const result = formatRelative(FIXED_DATE);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/ago$/);
  });

  it("accepts an ISO string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    expect(formatRelative("2026-04-18T11:55:00.000Z")).toMatch(/ago$/);
  });

  it("accepts a numeric timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    expect(formatRelative(FIXED_DATE.getTime())).toMatch(/ago$/);
  });

  it("includes 'ago' suffix for past dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const oneHourAgo = new Date(FIXED_NOW.getTime() - 60 * 60 * 1000);
    expect(formatRelative(oneHourAgo)).toContain("ago");
  });
});

describe("formatDate", () => {
  it("formats a Date object as a non-empty string", () => {
    const result = formatDate(FIXED_DATE);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts an ISO string and returns consistent output", () => {
    expect(formatDate(FIXED_DATE)).toBe(formatDate("2026-01-15T08:30:00.000Z"));
  });

  it("accepts a numeric timestamp and returns consistent output", () => {
    expect(formatDate(FIXED_DATE)).toBe(formatDate(FIXED_DATE.getTime()));
  });

  it("output differs from formatDateTime (no time component)", () => {
    // Locale-agnostic: medium-date differs from medium-date + short-time.
    expect(formatDate(FIXED_DATE)).not.toBe(formatDateTime(FIXED_DATE));
  });
});

describe("formatDateTime", () => {
  it("formats a Date object as a non-empty string including time", () => {
    const result = formatDateTime(FIXED_DATE);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Locale-agnostic: with time appended, output is longer than date-only.
    expect(result.length).toBeGreaterThan(formatDate(FIXED_DATE).length);
  });

  it("accepts an ISO string and returns consistent output", () => {
    expect(formatDateTime(FIXED_DATE)).toBe(
      formatDateTime("2026-01-15T08:30:00.000Z")
    );
  });

  it("accepts a numeric timestamp and returns consistent output", () => {
    expect(formatDateTime(FIXED_DATE)).toBe(
      formatDateTime(FIXED_DATE.getTime())
    );
  });

  it("output differs from formatDate for the same input", () => {
    expect(formatDateTime(FIXED_DATE)).not.toBe(formatDate(FIXED_DATE));
  });
});
