// pr-screenshots.mjs --files: naming pre-captured PNGs so the sticky comment
// groups them by page and viewport. A wrong parse puts a phone shot in the
// desktop column or silently drops a file, and nothing downstream checks.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { parseShotFiles } from "../../../../scripts/workflow/pr-screenshot-files.mjs";

const VIEWPORTS = ["desktop", "mobile-large", "mobile-small"];
const dir = mkdtempSync(path.join(tmpdir(), "pr-shot-files-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function png(name: string): string {
  const p = path.join(dir, name);
  writeFileSync(p, "");
  return p;
}

describe("parseShotFiles", () => {
  it("splits <viewport>-<id>.png, matching the longest viewport prefix", () => {
    const shots = parseShotFiles(
      [png("desktop-dont-sync.png"), png("mobile-large-dont-sync.png")],
      VIEWPORTS
    );
    expect(shots.map(({ id, vpName }) => ({ id, vpName }))).toEqual([
      { id: "dont-sync", vpName: "desktop" },
      { id: "dont-sync", vpName: "mobile-large" },
    ]);
  });

  it("rejects a name without a known viewport prefix", () => {
    expect(() =>
      parseShotFiles([png("mobile-dont-sync.png")], VIEWPORTS)
    ).toThrow(/<viewport>-<id>\.png/);
  });

  it("rejects a missing file and a non-PNG", () => {
    expect(() =>
      parseShotFiles([path.join(dir, "desktop-gone.png")], VIEWPORTS)
    ).toThrow(/does not exist/);
    expect(() => parseShotFiles([png("desktop-x.jpg")], VIEWPORTS)).toThrow(
      /not a \.png/
    );
  });

  it("rejects the same page and viewport twice", () => {
    const a = png("desktop-twice.png");
    expect(() => parseShotFiles([a, a], VIEWPORTS)).toThrow(/listed twice/);
  });

  it("rejects an empty list", () => {
    expect(() => parseShotFiles([], VIEWPORTS)).toThrow(/at least one/);
  });
});
