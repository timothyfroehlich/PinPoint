import type { PinTipForCard } from "./types";

/**
 * A tip's weight in the random pick: its vote total plus one, so a tip with
 * no votes can still appear (spec 3.2). Negative totals count as zero.
 */
function weight(tip: Pick<PinTipForCard, "voteTotal">): number {
  return Math.max(0, tip.voteTotal) + 1;
}

/**
 * Index of a tip picked at random, weighted by vote total (spec 3.2), or -1
 * for an empty list. `exclude` leaves one index out — the shuffle control
 * uses it so the next tip always differs from the one showing (spec 3.3) —
 * unless it is the only tip. `random` returns a number in [0, 1).
 */
export function pickWeightedTipIndex(
  tips: readonly Pick<PinTipForCard, "voteTotal">[],
  random: () => number = Math.random,
  exclude?: number
): number {
  const candidates = tips
    .map((tip, index) => ({ index, weight: weight(tip) }))
    .filter(({ index }) => tips.length === 1 || index !== exclude);
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let point = random() * total;
  for (const candidate of candidates) {
    point -= candidate.weight;
    if (point < 0) return candidate.index;
  }
  return candidates.at(-1)?.index ?? -1;
}
