import { describe, expect, it } from "vitest";

import { entryHiddenByMarking } from "../../../../scripts/lib/migration-record";

// Shaped like the real journal around 0011-0013: 0012's `when` predates 0011's.
const m0010 = { tag: "0010_a", when: 1000 };
const m0011 = { tag: "0011_b", when: 3000 };
const m0012 = { tag: "0012_c", when: 2000 };
const m0013 = { tag: "0013_d", when: 4000 };
const ENTRIES = [m0010, m0011, m0012, m0013];

describe("entryHiddenByMarking", () => {
  it("returns nothing when everything older than the target is applied", () => {
    expect(entryHiddenByMarking(ENTRIES, m0013, 3000)).toBeUndefined();
  });

  it("names an unapplied earlier entry that marking would hide", () => {
    expect(entryHiddenByMarking(ENTRIES, m0011, 0)?.tag).toBe("0010_a");
  });

  it("names a later entry with an older when that marking would hide", () => {
    // Only 0010 applied; marking 0011 (when 3000) would skip 0012 (when 2000).
    expect(entryHiddenByMarking(ENTRIES, m0011, 1000)?.tag).toBe("0012_c");
  });

  it("allows marking when the unapplied earlier entry is newer than the target", () => {
    // Only 0010 applied; marking 0012 (when 2000) leaves 0011 (when 3000) to run.
    expect(entryHiddenByMarking(ENTRIES, m0012, 1000)).toBeUndefined();
  });

  it("names an unapplied entry with the same when as the target", () => {
    // drizzle applies an entry only when created_at < when, so a tie is hidden.
    const twin = { tag: "0014_e", when: 4000 };
    expect(entryHiddenByMarking([...ENTRIES, twin], m0013, 3000)?.tag).toBe(
      "0014_e"
    );
  });

  it("excludes the target by tag, not object identity", () => {
    expect(entryHiddenByMarking(ENTRIES, { ...m0013 }, 3000)).toBeUndefined();
  });

  it("has nothing to hide when the target is the oldest entry", () => {
    expect(entryHiddenByMarking(ENTRIES, m0010, 0)).toBeUndefined();
  });
});
