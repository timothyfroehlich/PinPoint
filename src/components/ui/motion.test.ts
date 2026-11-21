import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CORE-UI-007: every shared primitive that renders floating content must
 * animate its open and close. shadcn primitives carry the classes themselves, so
 * a new one pasted in without them (or a refactor that drops them) fails here
 * instead of shipping an overlay that pops in and out.
 *
 * A static scan, not a render: the failure being guarded is a missing class
 * string, and a render would only see it through jsdom's lack of animations.
 */

const UI_DIR = __dirname;

// Libraries whose components render overlays. Mirrors the restricted-import
// patterns in .oxlintrc.json.
const OVERLAY_LIBRARY =
  /from\s+["'](@radix-ui\/[^"']+|radix-ui(\/[^"']+)?|vaul|cmdk|@floating-ui\/[^"']+)["']/;

// Floating content: a Radix/vaul Content or Overlay part, or the shared
// FloatingPanel built on @floating-ui.
const FLOATING_CONTENT = /\.(Content|Overlay)\b|from\s+["']@floating-ui\//;

// Primitives that import an overlay library and match FLOATING_CONTENT but
// should not animate. Each entry needs a reason; an empty list is the goal.
const NOT_ANIMATED: Record<string, string> = {};

function primitiveSources(): { file: string; source: string }[] {
  return readdirSync(UI_DIR)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((file) => ({
      file,
      source: readFileSync(path.join(UI_DIR, file), "utf8"),
    }));
}

describe("overlay primitives animate (CORE-UI-007)", () => {
  const floating = primitiveSources().filter(
    ({ source }) =>
      OVERLAY_LIBRARY.test(source) && FLOATING_CONTENT.test(source)
  );

  it("finds the floating primitives it is meant to guard", () => {
    const names = floating.map(({ file }) => file);
    expect(names).toEqual(
      expect.arrayContaining([
        "dialog.tsx",
        "dropdown-menu.tsx",
        "popover.tsx",
        "tooltip.tsx",
      ])
    );
  });

  it.each(floating.map(({ file, source }) => [file, source] as const))(
    "%s carries animate-in and animate-out",
    (file, source) => {
      if (file in NOT_ANIMATED) return;
      expect(source, `${file} needs animate-in`).toContain("animate-in");
      expect(source, `${file} needs animate-out`).toContain("animate-out");
    }
  );

  it("keeps the allowlist honest", () => {
    const names = new Set(floating.map(({ file }) => file));
    for (const file of Object.keys(NOT_ANIMATED)) {
      expect(names.has(file), `${file} is allowlisted but not floating`).toBe(
        true
      );
    }
  });
});
