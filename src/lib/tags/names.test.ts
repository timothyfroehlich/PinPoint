import { describe, expect, it } from "vitest";
import {
  slugifyTagName,
  tagNameSchema,
  tagTypeNameSchema,
  uniqueSlug,
} from "./names";

/** Spec collections-and-tags 11.2–11.3: name rules for tags and tag types. */
describe("tag names", () => {
  it("stores names trimmed with inner whitespace collapsed", () => {
    expect(tagNameSchema.parse("  Back \t  room\n")).toBe("Back room");
  });

  it("caps names at 20 characters after normalizing", () => {
    expect(tagNameSchema.safeParse(`  ${"a".repeat(20)}  `).success).toBe(true);
    expect(tagNameSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(tagNameSchema.safeParse("   ").success).toBe(false);
  });

  it.each([
    ["Manufacturer", "Name already used"],
    ["player count", "Name already used"],
    ["Player-Count", "Name already used"],
    ["  TYPE ", "Name already used"],
    ["Display!", "Name already used"],
    ["Other", "Name reserved"],
  ])("refuses tag type name %j: %s", (name, message) => {
    const result = tagTypeNameSchema.safeParse(name);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("accepts a tag type name that only resembles an automatic one", () => {
    expect(tagTypeNameSchema.parse("Display case")).toBe("Display case");
    expect(tagTypeNameSchema.parse("Other games")).toBe("Other games");
  });
});

describe("tag slugs", () => {
  it.each([
    ["Tournament-ready", "tournament-ready"],
    ["  Café   Wall! ", "cafe-wall"],
    ["4 Players +", "4-players"],
    ["日本", "tag"],
  ])("slugifies %j to %j", (name, slug) => {
    expect(slugifyTagName(name, "tag")).toBe(slug);
  });

  it("suffixes -2, -3 past slugs already taken", () => {
    expect(uniqueSlug("topper", new Set())).toBe("topper");
    expect(uniqueSlug("topper", new Set(["topper", "topper-2"]))).toBe(
      "topper-3"
    );
  });
});
