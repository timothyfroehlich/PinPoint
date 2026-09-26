import { describe, expect, it } from "vitest";
import { displayTag, playersTag, typeTag } from "./opdb";
import { tagHref } from "./types";

describe("OPDB tag labels", () => {
  it("names the Type tags from spec 9.3", () => {
    expect(typeTag("em")?.name).toBe("Electromechanical");
    expect(typeTag("ss")).toMatchObject({
      slug: "solid-state",
      name: "Solid State",
    });
    expect(typeTag("me")?.name).toBe("Pure Mechanical");
    expect(typeTag(null)).toBeNull();
  });

  it("capitalizes Display tags and upper-cases acronyms (spec 9.4)", () => {
    expect(displayTag("reels")?.name).toBe("Reels");
    expect(displayTag("alphanumeric")?.name).toBe("Alphanumeric");
    expect(displayTag("dmd")).toMatchObject({ slug: "dmd", name: "DMD" });
    expect(displayTag("lcd")?.name).toBe("LCD");
    expect(displayTag("cga")?.name).toBe("CGA");
    expect(displayTag(null)).toBeNull();
  });

  it("names Player Count tags singular for one, plural otherwise (spec 9.5)", () => {
    expect(playersTag(1)).toMatchObject({ slug: "1-player", name: "1 Player" });
    expect(playersTag(4)).toMatchObject({
      slug: "4-players",
      name: "4 Players",
    });
    expect(playersTag(null)).toBeNull();
    expect(playersTag(0)).toBeNull();
  });
});

describe("tagHref", () => {
  it("links a tag's page by its URL-encoded address", () => {
    expect(tagHref("manufacturer", "a&b")).toBe("/c/tags/manufacturer/a%26b");
    expect(tagHref("player-count", "4-players")).toBe(
      "/c/tags/player-count/4-players"
    );
  });
});
