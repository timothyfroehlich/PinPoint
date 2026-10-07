import { describe, expect, it } from "vitest";

import { earlierEntryHiddenByMarking } from "../../../../scripts/lib/migration-record";

// Shaped like the real journal around 0011-0013: 0012's `when` predates 0011's.
const ENTRIES = [
  { tag: "0010_a", when: 1000 },
  { tag: "0011_b", when: 3000 },
  { tag: "0012_c", when: 2000 },
  { tag: "0013_d", when: 4000 },
];

describe("earlierEntryHiddenByMarking", () => {
  it("returns nothing when every earlier entry is covered", () => {
    expect(earlierEntryHiddenByMarking(ENTRIES, 3, 3000)).toBeUndefined();
  });

  it("names the unrecorded earlier entry that marking would hide", () => {
    expect(earlierEntryHiddenByMarking(ENTRIES, 1, 0)?.tag).toBe("0010_a");
  });

  it("bounds by the newest earlier when, not the previous entry's", () => {
    // Newest applied sits between 0012 and 0011: the previous entry (0012) is
    // covered, but 0011 is not, and marking 0013 would hide it.
    expect(earlierEntryHiddenByMarking(ENTRIES, 3, 2500)?.tag).toBe("0011_b");
  });

  it("has nothing earlier to hide for the first entry", () => {
    expect(earlierEntryHiddenByMarking(ENTRIES, 0, 0)).toBeUndefined();
  });
});
