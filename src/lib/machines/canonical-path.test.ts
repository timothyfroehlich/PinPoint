import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalMachinePath } from "./canonical-path";

describe("canonicalMachinePath", () => {
  it("uppercases a lowercase initials segment", () => {
    expect(canonicalMachinePath("/m/afm")).toBe("/m/AFM");
    expect(canonicalMachinePath("/m/rush")).toBe("/m/RUSH");
    expect(canonicalMachinePath("/m/Afm")).toBe("/m/AFM");
  });

  it("returns null when the path is already canonical", () => {
    expect(canonicalMachinePath("/m/AFM")).toBeNull();
    expect(canonicalMachinePath("/m/GB2")).toBeNull();
  });

  it("preserves everything after the initials segment", () => {
    expect(canonicalMachinePath("/m/afm/maintenance")).toBe(
      "/m/AFM/maintenance"
    );
    expect(canonicalMachinePath("/m/afm/i/12")).toBe("/m/AFM/i/12");
    expect(canonicalMachinePath("/m/afm/edit")).toBe("/m/AFM/edit");
    // A trailing slash is part of the path, not an empty extra segment to drop.
    expect(canonicalMachinePath("/m/afm/")).toBe("/m/AFM/");
  });

  it("leaves the reserved /m/new create route alone", () => {
    expect(canonicalMachinePath("/m/new")).toBeNull();
    // Reserved segments keep their own casing rather than being uppercased
    // into a machine lookup.
    expect(canonicalMachinePath("/M/new")).toBe("/m/new");
  });

  /**
   * The reserved list is the one part of this module that goes stale silently:
   * add `src/app/(app)/m/bulk/` and `/m/bulk` starts redirecting to `/m/BULK`
   * and 404ing, in a file whose author never opened this one. Read the route
   * directory instead of trusting the comment.
   */
  it("reserves every static route directory under /m/", () => {
    const routeDir = join(process.cwd(), "src/app/(app)/m");
    const staticSegments = readdirSync(routeDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith("[") && !name.startsWith("("));

    expect(staticSegments.length).toBeGreaterThan(0);
    for (const segment of staticSegments) {
      expect(canonicalMachinePath(`/m/${segment}`)).toBeNull();
    }
  });

  it("uppercases a lowercase /m prefix too", () => {
    // Phone keyboards capitalize the first character of what they take to be
    // a sentence, so /M/afm is a link people actually produce.
    expect(canonicalMachinePath("/M/afm")).toBe("/m/AFM");
    expect(canonicalMachinePath("/M/AFM")).toBe("/m/AFM");
  });

  it("ignores paths that are not machine detail pages", () => {
    expect(canonicalMachinePath("/m")).toBeNull();
    expect(canonicalMachinePath("/m/")).toBeNull();
    expect(canonicalMachinePath("/issues")).toBeNull();
    expect(canonicalMachinePath("/c/some-collection-handle")).toBeNull();
    expect(canonicalMachinePath("/machines/afm")).toBeNull();
  });

  it("ignores segments that cannot be initials", () => {
    // Outside the 2-6 char alphanumeric shape the DB constraint allows.
    expect(canonicalMachinePath("/m/a")).toBeNull();
    expect(canonicalMachinePath("/m/toolongforinitials")).toBeNull();
    expect(canonicalMachinePath("/m/af-m")).toBeNull();
  });
});
