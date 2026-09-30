// Pre-captured screenshot parsing for pr-screenshots.mjs --files.
//
// The manifest only covers fixed routes, so a screenshot of a particular UI
// state (a toggle set one way, a dialog open) has to be shot by hand. Before
// --files existed, agents re-implemented the publish step in the shell — a
// throwaway repo, `rm -rf`, a push to pr-screenshots — and the `rm -rf` hit
// the `Bash(rm -rf:*)` ask rule, prompting Tim for every post. --files lets
// those shots reuse the script's own publish and sticky-comment code.
//
// Each file is named `<viewport>-<id>.png`, the same naming the capture path
// uses, so the comment groups a page's viewports into one row.

import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

/**
 * Turn `--files` paths into the `captured` shape publishScreenshots and
 * buildCommentBody consume. Throws on a missing file, a non-PNG, a name
 * without a known viewport prefix, or two files for the same page+viewport.
 *
 * @param {string[]} paths
 * @param {string[]} viewportNames  keys of VIEWPORTS
 */
export function parseShotFiles(paths, viewportNames) {
  if (paths.length === 0) {
    throw new Error("--files needs at least one PNG path");
  }
  // Longest first, so a name like "mobile-large-x" never matches a shorter
  // viewport that happens to prefix it.
  const byLength = [...viewportNames].sort((a, b) => b.length - a.length);
  const seen = new Set();

  return paths.map((path) => {
    const outPath = resolve(path);
    if (!existsSync(outPath)) {
      throw new Error(`--files: ${path} does not exist`);
    }
    const fileName = basename(outPath);
    if (!fileName.toLowerCase().endsWith(".png")) {
      throw new Error(`--files: ${fileName} is not a .png`);
    }
    const stem = fileName.slice(0, -".png".length);
    const vpName = byLength.find((vp) => stem.startsWith(`${vp}-`));
    if (!vpName) {
      throw new Error(
        `--files: ${fileName} must be named <viewport>-<id>.png, ` +
          `with viewport one of: ${viewportNames.join(", ")}`
      );
    }
    const id = stem.slice(vpName.length + 1);
    if (!id) {
      throw new Error(`--files: ${fileName} has no <id> after the viewport`);
    }
    const key = `${vpName}-${id}`;
    if (seen.has(key)) {
      throw new Error(`--files: ${fileName} is listed twice`);
    }
    seen.add(key);
    return { id, label: id, vpName, fileName, outPath };
  });
}
