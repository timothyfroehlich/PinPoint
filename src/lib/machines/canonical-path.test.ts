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
