import { describe, it, expect } from "vitest";
import {
  TIMELINE_TAGS,
  RESERVED_TAGS,
  tagSchema,
  userTagSchema,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";

describe("machine-tags", () => {
  it("exposes the V2 tag list", () => {
    expect([...TIMELINE_TAGS]).toEqual([
      "lifecycle",
      "issue",
      "maintenance",
      "adjustment",
      "parts",
      "upgrade",
      "cleaning",
      "inspection",
      "note",
      "highlight",
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
    expect(userTagSchema.parse("adjustment")).toBe("adjustment");
    expect(userTagSchema.parse("parts")).toBe("parts");
    expect(userTagSchema.parse("upgrade")).toBe("upgrade");
    expect(userTagSchema.parse("cleaning")).toBe("cleaning");
    expect(userTagSchema.parse("inspection")).toBe("inspection");
    expect(userTagSchema.parse("note")).toBe("note");
    expect(userTagSchema.parse("highlight")).toBe("highlight");
  });

  it("userTagSchema rejects retired `event` tag", () => {
    expect(() => userTagSchema.parse("event")).toThrow();
  });

  it("TimelineTag type narrows correctly", () => {
    const t: TimelineTag = "maintenance";
    // @ts-expect-error — "software_update" is not in the union
    const bad: TimelineTag = "software_update";
    expect(t).toBe("maintenance");
    expect(bad).toBe("software_update"); // runtime still works, compile blocks
  });
});
