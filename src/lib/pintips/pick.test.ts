import { describe, expect, it } from "vitest";
import { pickWeightedTipIndex } from "./pick";

// Weights are vote total + 1: [1, 4, 6] over a total of 11.
const tips = [{ voteTotal: 0 }, { voteTotal: 3 }, { voteTotal: 5 }];

describe("pickWeightedTipIndex", () => {
  it("maps the random draw across tips in proportion to their weight", () => {
    expect(pickWeightedTipIndex(tips, () => 0)).toBe(0);
    expect(pickWeightedTipIndex(tips, () => 0.99 / 11)).toBe(0);
    expect(pickWeightedTipIndex(tips, () => 1 / 11)).toBe(1);
    expect(pickWeightedTipIndex(tips, () => 4.99 / 11)).toBe(1);
    expect(pickWeightedTipIndex(tips, () => 5 / 11)).toBe(2);
    expect(pickWeightedTipIndex(tips, () => 0.9999)).toBe(2);
  });

  it("gives a tip with no votes a chance to appear (spec 3.2)", () => {
    expect(pickWeightedTipIndex([{ voteTotal: 0 }], () => 0.5)).toBe(0);
  });

  it("treats a negative vote total as zero", () => {
    expect(
      pickWeightedTipIndex([{ voteTotal: -4 }, { voteTotal: 0 }], () => 0.4)
    ).toBe(0);
  });

  it("never repeats the excluded tip when another exists (spec 3.3)", () => {
    for (const r of [0, 0.3, 0.6, 0.9999]) {
      expect(pickWeightedTipIndex(tips, () => r, 2)).not.toBe(2);
    }
    expect(pickWeightedTipIndex([{ voteTotal: 1 }], () => 0.5, 0)).toBe(0);
  });

  it("returns -1 for no tips", () => {
    expect(pickWeightedTipIndex([], () => 0.5)).toBe(-1);
  });
});
