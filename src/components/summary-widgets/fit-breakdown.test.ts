import { describe, expect, it } from "vitest";
import { fitBreakdown } from "./fit-breakdown";

// Three pairs of 60, 80, and 100px with 10px gaps: the whole line is 260px.
const segmentWidths = [60, 80, 100];
const fit = (availableWidth: number, otherWidth = 50): number =>
  fitBreakdown({ availableWidth, segmentWidths, otherWidth, gap: 10 });

describe("fitBreakdown (widgets §5.6)", () => {
  it("shows every Segment when the whole line fits, without an other entry", () => {
    expect(fit(260)).toBe(3);
    expect(fit(500)).toBe(3);
  });

  it("keeps whole pairs from the start and leaves room for N other", () => {
    // 60 + 10 + 80 + 10 + 50 (other) = 210; the whole line (260) misses.
    expect(fit(258)).toBe(2);
    expect(fit(210)).toBe(2);
    // One pixel short of two pairs plus other keeps only the first.
    expect(fit(208)).toBe(1);
  });

  it("never skips a pair that does not fit to show a later, narrower one", () => {
    const fitted = fitBreakdown({
      availableWidth: 175,
      segmentWidths: [60, 120, 20],
      otherWidth: 50,
      gap: 10,
    });
    // 60 + 10 + 50 = 120 fits; 60 + 10 + 120 + 10 + 50 does not. The 20px
    // pair after the wide one would fit on its own, but stays rolled up.
    expect(fitted).toBe(1);
  });

  it("rolls every Segment into N other when not even the first pair fits", () => {
    expect(fit(100)).toBe(0);
    expect(fit(0)).toBe(0);
  });

  it("counts an empty breakdown as fully shown", () => {
    expect(
      fitBreakdown({
        availableWidth: 0,
        segmentWidths: [],
        otherWidth: 50,
        gap: 10,
      })
    ).toBe(0);
  });
});
