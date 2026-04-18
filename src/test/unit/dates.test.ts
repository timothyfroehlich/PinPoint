import { describe, it, expect, vi } from "vitest";
import { formatRelative, formatDate, formatDateTime } from "~/lib/dates";

// A fixed point in time for deterministic relative assertions.
const FIXED_NOW = new Date("2026-04-18T12:00:00.000Z");
const FIXED_DATE = new Date("2026-01-15T08:30:00.000Z"); // ~3 months before FIXED_NOW

describe("formatRelative", () => {
  it("returns empty string for null", () => {
    expect(formatRelative(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatRelative(undefined)).toBe("");
  });

  it("accepts a Date object and returns a string with 'ago' suffix", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const result = formatRelative(FIXED_DATE);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/ago$/);
    vi.useRealTimers();
  });

  it("accepts an ISO string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const result = formatRelative("2026-04-18T11:55:00.000Z");
    expect(result).toMatch(/ago$/);
    vi.useRealTimers();
  });

  it("accepts a numeric timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const result = formatRelative(FIXED_DATE.getTime());
    expect(result).toMatch(/ago$/);
    vi.useRealTimers();
  });

  it("includes 'ago' suffix for past dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const oneHourAgo = new Date(FIXED_NOW.getTime() - 60 * 60 * 1000);
    expect(formatRelative(oneHourAgo)).toContain("ago");
    vi.useRealTimers();
  });
});

describe("formatDate", () => {
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("formats a Date object as a non-empty string", () => {
    const result = formatDate(FIXED_DATE);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts an ISO string and returns consistent output", () => {
    const fromDate = formatDate(FIXED_DATE);
    const fromString = formatDate("2026-01-15T08:30:00.000Z");
    expect(fromDate).toBe(fromString);
  });

  it("accepts a numeric timestamp and returns consistent output", () => {
    const fromDate = formatDate(FIXED_DATE);
    const fromTimestamp = formatDate(FIXED_DATE.getTime());
    expect(fromDate).toBe(fromTimestamp);
  });

  it("does not include time component (no colon-separated time)", () => {
    // dateStyle: "medium" should never include time
    const result = formatDate(FIXED_DATE);
    // A time component would look like "8:30" or "08:30"
    expect(result).not.toMatch(/\d:\d\d/);
  });

  it("includes the year in output", () => {
    const result = formatDate(FIXED_DATE);
    expect(result).toContain("2026");
  });
});

describe("formatDateTime", () => {
  it("returns empty string for null", () => {
    expect(formatDateTime(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDateTime(undefined)).toBe("");
  });

  it("formats a Date object as a non-empty string including time", () => {
    const result = formatDateTime(FIXED_DATE);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Time component should be present (colon-separated)
    expect(result).toMatch(/\d:\d\d/);
  });

  it("accepts an ISO string and returns consistent output", () => {
    const fromDate = formatDateTime(FIXED_DATE);
    const fromString = formatDateTime("2026-01-15T08:30:00.000Z");
    expect(fromDate).toBe(fromString);
  });

  it("accepts a numeric timestamp and returns consistent output", () => {
    const fromDate = formatDateTime(FIXED_DATE);
    const fromTimestamp = formatDateTime(FIXED_DATE.getTime());
    expect(fromDate).toBe(fromTimestamp);
  });

  it("includes the year in output", () => {
    const result = formatDateTime(FIXED_DATE);
    expect(result).toContain("2026");
  });
});
