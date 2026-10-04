import { describe, expect, it } from "vitest";

import { chipsThatFit } from "./chip-fit";

/** The phone Tags card: chips on one line, the rest behind "+N" (PP-wqit.3). */
describe("chipsThatFit", () => {
  it.each([
    // widths, more, gap, available, expected
    {
      widths: [50, 50, 50],
      available: 162,
      expected: 3,
      why: "all fit exactly",
    },
    {
      widths: [50, 50, 50],
      available: 161,
      expected: 2,
      why: "room kept for +N",
    },
    {
      widths: [50, 50, 50, 50],
      available: 140,
      expected: 1,
      why: "+N needs its own room",
    },
    {
      widths: [300, 50],
      available: 200,
      expected: 1,
      why: "the first chip always shows",
    },
    { widths: [], available: 100, expected: 0, why: "no tags" },
  ])("$why", ({ widths, available, expected }) => {
    expect(chipsThatFit(widths, 30, 6, available)).toBe(expected);
  });
});
