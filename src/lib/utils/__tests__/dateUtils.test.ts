import { formatDate, parseIssueDate, getRelativeTime } from "../dateUtils";
import { testFunctionWithScenarios } from "~/test/helpers/pure-function-test-utils";
import { describe, test, expect } from "vitest";

describe("Date Utilities", () => {
  describe("formatDate", () => {
    testFunctionWithScenarios(formatDate, [
      {
        input: new Date("2024-01-01T12:00:00Z"),
        expected: "Jan 1, 2024",
        description: "formats standard date",
      },
      {
        input: new Date("2024-12-31T23:59:59Z"),
        expected: "Dec 31, 2024",
        description: "formats end of year",
      },
      {
        input: new Date("2024-02-29T00:00:00Z"), // Leap year
        expected: "Feb 29, 2024",
        description: "handles leap year",
      },
    ]);

    test("handles invalid dates", () => {
      expect(() => formatDate(new Date("invalid"))).toThrow("Invalid date");
    });
  });

  describe("parseIssueDate", () => {
    test("parses ISO date strings", () => {
      const result = parseIssueDate("2024-01-15T10:30:00Z");
      expect(result).toEqual(new Date("2024-01-15T10:30:00Z"));
    });

    test("handles malformed date strings", () => {
      expect(() => parseIssueDate("not-a-date")).toThrow("Invalid date format");
    });
  });

  describe("getRelativeTime", () => {
    test("returns relative time strings", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const oneHourAgo = new Date("2024-01-15T11:00:00Z");
      const oneDayAgo = new Date("2024-01-14T12:00:00Z");

      expect(getRelativeTime(oneHourAgo, now)).toBe("1 hour ago");
      expect(getRelativeTime(oneDayAgo, now)).toBe("1 day ago");
    });
  });
});
