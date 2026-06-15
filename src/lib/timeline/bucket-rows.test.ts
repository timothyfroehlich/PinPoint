import { describe, expect, it } from "vitest";
import { bucketTimelineRows } from "./bucket-rows";

// Use dates months apart in the distant past so each falls in its own
// month-tier bucket — deterministic regardless of the current date.
const JAN = new Date("2020-01-15T12:00:00Z");
const JAN_LATER = new Date("2020-01-20T12:00:00Z");
const FEB = new Date("2020-02-10T12:00:00Z");

describe("bucketTimelineRows", () => {
  it("returns no groups for an empty list", () => {
    expect(bucketTimelineRows([])).toEqual([]);
  });

  it("groups consecutive rows that share a bucket key", () => {
    const groups = bucketTimelineRows([
      { createdAt: JAN, id: "a" },
      { createdAt: JAN_LATER, id: "b" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries.map((e) => e.row.id)).toEqual(["a", "b"]);
  });

  it("opens a new group when the bucket key changes", () => {
    const groups = bucketTimelineRows([
      { createdAt: JAN, id: "a" },
      { createdAt: FEB, id: "b" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.entries).toHaveLength(1);
    expect(groups[1]?.entries).toHaveLength(1);
  });

  it("preserves each entry's own bucket alongside the group bucket", () => {
    const groups = bucketTimelineRows([{ createdAt: JAN, id: "a" }]);
    expect(groups[0]?.entries[0]?.bucket.key).toBe(groups[0]?.bucket.key);
  });
});
