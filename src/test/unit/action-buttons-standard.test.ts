/**
 * Guard for the action-button standard (design-bible §26): every page
 * header's actions go through PageActions and every item's ⋯ menu through
 * ItemActionsMenu, with one overflow icon. A static scan of `src/`, kept out
 * of oxlint because `.oxlintrc.json`'s `no-restricted-imports` belongs to the
 * Radix import rule.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");
const SELF = "test/unit/action-buttons-standard.test.ts";

const USE_INSTEAD =
  "Use PageActions for a page's actions or ItemActionsMenu for an item's ⋯ menu (design-bible §26).";

/**
 * The only files that may draw the ⋯ (MoreHorizontal) icon themselves.
 */
const MORE_HORIZONTAL_ALLOWED = new Set([
  // The shared page actions and their More menu.
  "components/list-view/PageActions.tsx",
  // The shared item ⋯ menu.
  "components/list-view/ItemActionsMenu.tsx",
  // A tab strip's overflow of extra tabs: navigation, not actions (§26.3).
  "components/layout/RouteTabStrip.tsx",
  // The tab bar's More sheet: navigation, not actions (§26.3).
  "components/layout/BottomTabBar.tsx",
  // Issue detail keeps its own header (§26.1 exception): the phone More
  // menu must stay a non-modal dropdown so Edit title can raise the iOS
  // keyboard.
  "app/(app)/m/[initials]/i/[issueNumber]/editable-issue-title.tsx",
]);

/** Vertical dots and every Ellipsis icon: ⋯ is the one overflow icon. */
const BANNED_ICON =
  /^(Lucide)?(MoreVertical|EllipsisVertical|Ellipsis\w*)(Icon)?$/;
const MORE_HORIZONTAL = /^(Lucide)?MoreHorizontal(Icon)?$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const files = sourceFiles(SRC)
  .map((path) => ({
    path: relative(SRC, path).split(sep).join("/"),
    text: readFileSync(path, "utf8"),
  }))
  .filter((file) => file.path !== SELF);

/** Every name imported from lucide-react in a file. */
function lucideImports(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']lucide-react["']/g
  )) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

describe("action-button standard (design-bible §26)", () => {
  it("scans the source tree", () => {
    expect(files.length).toBeGreaterThan(100);
    // The allowlist names real files, so a move can't silently widen it.
    const paths = new Set(files.map((file) => file.path));
    for (const allowed of MORE_HORIZONTAL_ALLOWED) {
      expect(paths, allowed).toContain(allowed);
    }
  });

  it("reads multi-line, aliased and type-only lucide imports", () => {
    const sample = `import {\n  Plus,\n  MoreVertical as Kebab,\n} from "lucide-react";\nimport { type EllipsisIcon } from 'lucide-react';`;
    const names = lucideImports(sample);
    expect(names).toEqual(["Plus", "MoreVertical", "EllipsisIcon"]);
    expect(names.filter((name) => BANNED_ICON.test(name))).toHaveLength(2);
  });

  it("imports no vertical-dots or Ellipsis icon", () => {
    const offenders = files.flatMap((file) =>
      lucideImports(file.text)
        .filter((name) => BANNED_ICON.test(name))
        .map((name) => `${file.path}: ${name}`)
    );
    expect(
      offenders,
      `⋯ (MoreHorizontal) is the one overflow icon. ${USE_INSTEAD}`
    ).toEqual([]);
  });

  it("draws ⋯ only in the shared components and the allowed navigation", () => {
    const offenders = files
      .filter((file) => !MORE_HORIZONTAL_ALLOWED.has(file.path))
      .filter((file) =>
        lucideImports(file.text).some((name) => MORE_HORIZONTAL.test(name))
      )
      .map((file) => file.path);
    expect(offenders, `A hand-rolled ⋯ menu. ${USE_INSTEAD}`).toEqual([]);
  });

  it("never ends a Delete entry in …, since Delete only confirms (§26.3)", () => {
    const offenders = files.flatMap((file) =>
      [
        // A string literal, such as a menu entry's label.
        ...file.text.matchAll(/["'`](Delete\b[^"'`\n]*…)["'`]/g),
        // JSX text, such as a hand-written menu item.
        ...file.text.matchAll(/>\s*(Delete\b[^<>{}\n]*…)\s*</g),
      ].map((match) => `${file.path}: ${match[1] ?? ""}`)
    );
    expect(
      offenders,
      `"…" marks an entry that asks for more input; Delete only confirms, so it reads "Delete tag", not "Delete tag…". ${USE_INSTEAD}`
    ).toEqual([]);
  });
});
