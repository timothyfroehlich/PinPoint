import { describe, expect, it } from "vitest";
import { describeSchedule, formatCentralHour } from "./events";

describe("describeSchedule", () => {
  it.each([
    [24, 18, "Posts daily at 6 PM Central."],
    [24, 0, "Posts daily at 12 AM Central."],
    [24, 12, "Posts daily at 12 PM Central."],
    [1, 18, "Posts every hour, on the hour, Central time."],
    [4, 18, "Posts at 2 AM, 6 AM, 10 AM, 2 PM, 6 PM, 10 PM Central."],
    [12, 9, "Posts at 9 AM, 9 PM Central."],
    [12, 21, "Posts at 9 AM, 9 PM Central."],
    [6, 23, "Posts at 5 AM, 11 AM, 5 PM, 11 PM Central."],
    [
      2,
      1,
      "Posts at 1 AM, 3 AM, 5 AM, 7 AM, 9 AM, 11 AM, 1 PM, 3 PM, 5 PM, 7 PM, 9 PM, 11 PM Central.",
    ],
    [null, 18, "Off. No summaries post."],
  ])("interval %s from hour %s → %s", (interval, startHour, expected) => {
    expect(describeSchedule(interval, startHour)).toBe(expected);
  });
});

describe("formatCentralHour", () => {
  it.each([
    [0, "12 AM"],
    [1, "1 AM"],
    [11, "11 AM"],
    [12, "12 PM"],
    [13, "1 PM"],
    [23, "11 PM"],
  ])("hour %s → %s", (hour, expected) => {
    expect(formatCentralHour(hour)).toBe(expected);
  });
});
