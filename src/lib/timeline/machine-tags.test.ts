import { describe, it, expect } from "vitest";
import {
  TIMELINE_TAGS,
  RESERVED_TAGS,
  tagSchema,
  userTagSchema,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";

describe("machine-tags", () => {
  it("exposes the V1 tag list", () => {
    expect([...TIMELINE_TAGS]).toEqual([
      "lifecycle",
      "issue",
      "maintenance",
      "event",
      "cleaning",
    ]);
  });

  it("marks lifecycle and issue as reserved", () => {
    expect([...RESERVED_TAGS]).toEqual(["lifecycle", "issue"]);
  });

  it("tagSchema accepts any built-in tag", () => {
    for (const tag of TIMELINE_TAGS) {
      expect(tagSchema.parse(tag)).toBe(tag);
    }
  });

  it("tagSchema rejects unknown tags", () => {
    expect(() => tagSchema.parse("software_update")).toThrow();
    expect(() => tagSchema.parse("")).toThrow();
    expect(() => tagSchema.parse("LIFECYCLE")).toThrow();
  });

  it("userTagSchema rejects reserved tags", () => {
    expect(() => userTagSchema.parse("lifecycle")).toThrow();
    expect(() => userTagSchema.parse("issue")).toThrow();
    expect(userTagSchema.parse("maintenance")).toBe("maintenance");
    expect(userTagSchema.parse("event")).toBe("event");
    expect(userTagSchema.parse("cleaning")).toBe("cleaning");
  });

  it("TimelineTag type narrows correctly", () => {
    const t: TimelineTag = "maintenance";
    // @ts-expect-error — "software_update" is not in the union
    const bad: TimelineTag = "software_update";
    expect(t).toBe("maintenance");
    expect(bad).toBe("software_update"); // runtime still works, compile blocks
  });
});
