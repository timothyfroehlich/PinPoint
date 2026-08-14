// Unit tests for `normalizeCommand` / `workspacePrefixes`, exported from
// .claude/hooks/normalize-workspace-paths.cjs.
//
// The `exists` probe is injected, so these run without touching the filesystem.
//
// The regression under test (PP-xbfn) had two halves, both visible from a Mac
// session driving crabbox:
//
//   - The matcher hardcoded `/home/froeht/Code/PinPoint`, which on the Mac names
//     no local directory — it is Bazzite's path. So it rewrote paths meant for
//     the REMOTE box.
//   - It was unanchored, so it matched in the MIDDLE of `/var/home/froeht/...`
//     (Bazzite's canonical home; `/home` is a symlink to it) and stripped the
//     inner span, leaving `/var` glued to the tail. A crabbox run carrying
//     `CRABBOX_STATIC_WORK_ROOT=/var/home/froeht/Code/PinPoint/.claude/worktrees/...`
//     died on `mkdir: cannot create directory '/var.claude'`.

import { createRequire } from "node:module";
import path from "node:path";
import { describe, it, expect } from "vitest";

const require = createRequire(import.meta.url);
const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/normalize-workspace-paths.cjs"
);
const { normalizeCommand, workspacePrefixes } = require(hookPath) as {
  normalizeCommand: (
    command: string,
    repoRoot: string,
    exists?: (p: string) => boolean
  ) => { modified: string; rewrites: string[] };
  workspacePrefixes: (repoRoot: string) => string[];
};

/** A Mac session — the machine that drives crabbox. */
const MAC_ROOT = "/Users/froeht/Code/PinPoint";
/** A Bazzite session, where the repo really does live under /var/home. */
const BAZZITE_ROOT = "/var/home/froeht/Code/PinPoint";

/** Every candidate tail exists — the permissive case. */
const allExist = () => true;
/** Nothing exists — the guard should suppress every rewrite. */
const noneExist = () => false;

function run(
  command: string,
  repoRoot = MAC_ROOT,
  exists: (p: string) => boolean = allExist
): string {
  return normalizeCommand(command, repoRoot, exists).modified;
}

// ---------------------------------------------------------------------------
// The regression: a Mac session must not touch Bazzite paths at all
// ---------------------------------------------------------------------------
describe("remote (Bazzite) paths seen from a Mac session", () => {
  it("leaves a crabbox work root untouched", () => {
    const cmd =
      "CRABBOX_STATIC_WORK_ROOT=/var/home/froeht/Code/PinPoint/.claude/worktrees/crabbox-runner crabbox job run smoke";
    expect(run(cmd)).toBe(cmd);
  });

  it("never produces the orphaned /var prefix", () => {
    expect(
      run("ls /var/home/froeht/Code/PinPoint/.claude/worktrees")
    ).not.toContain("/var.claude");
  });

  it("leaves an ssh command's remote path untouched", () => {
    const cmd = "ssh bazzite 'ls /home/froeht/Code/PinPoint/scripts'";
    expect(run(cmd)).toBe(cmd);
  });
});

// ---------------------------------------------------------------------------
// On Bazzite itself, both spellings of the local root still rewrite
// ---------------------------------------------------------------------------
describe("a Bazzite session's own repo root", () => {
  it("rewrites the canonical /var/home spelling in full", () => {
    expect(
      run("bash /var/home/froeht/Code/PinPoint/scripts/x.sh", BAZZITE_ROOT)
    ).toBe("bash scripts/x.sh");
  });

  it("rewrites the symlinked /home spelling too", () => {
    expect(
      run("bash /home/froeht/Code/PinPoint/scripts/x.sh", BAZZITE_ROOT)
    ).toBe("bash scripts/x.sh");
  });

  it("offers both spellings as prefixes", () => {
    expect(workspacePrefixes(BAZZITE_ROOT)).toEqual(
      expect.arrayContaining([BAZZITE_ROOT, "/home/froeht/Code/PinPoint"])
    );
  });
});

// ---------------------------------------------------------------------------
// Boundary: the match must start a path, not continue one
// ---------------------------------------------------------------------------
describe("path boundaries", () => {
  it("ignores an unrelated prefix that merely contains the root", () => {
    const cmd = "ls /aaa/Users/froeht/Code/PinPoint/scripts/x.sh";
    expect(run(cmd)).toBe(cmd);
  });

  it("ignores a root embedded after a word character", () => {
    const cmd = "ls fooUsers/froeht/Code/PinPoint/scripts/x.sh";
    expect(run(cmd)).toBe(cmd);
  });

  it("still matches after a quote", () => {
    expect(run(`bash "${MAC_ROOT}/scripts/x.sh"`)).toBe(`bash "scripts/x.sh"`);
  });

  it("still matches after an = in an assignment", () => {
    expect(run(`P=${MAC_ROOT}/scripts/x.sh`)).toBe("P=scripts/x.sh");
  });
});

// ---------------------------------------------------------------------------
// The allowlist rewrite it exists for
// ---------------------------------------------------------------------------
describe("the allowlist rewrite it exists for", () => {
  it("rewrites a script path to relative", () => {
    expect(run(`bash ${MAC_ROOT}/scripts/workflow/merge-pr.sh 1039`)).toBe(
      "bash scripts/workflow/merge-pr.sh 1039"
    );
  });

  it("rewrites every occurrence in one command", () => {
    expect(run(`diff ${MAC_ROOT}/a.txt ${MAC_ROOT}/b.txt`)).toBe(
      "diff a.txt b.txt"
    );
  });

  it("leaves the path alone when the tail does not exist locally", () => {
    const cmd = `ls ${MAC_ROOT}/nope/missing`;
    expect(run(cmd, MAC_ROOT, noneExist)).toBe(cmd);
  });

  it("reports what it rewrote", () => {
    const { rewrites } = normalizeCommand(
      `bash ${MAC_ROOT}/scripts/x.sh`,
      MAC_ROOT,
      allExist
    );
    expect(rewrites).toHaveLength(1);
    expect(rewrites[0]).toContain("-> scripts/x.sh");
  });

  it("leaves a command with no workspace path untouched", () => {
    const cmd = "pnpm run check";
    expect(run(cmd)).toBe(cmd);
    expect(normalizeCommand(cmd, MAC_ROOT, allExist).rewrites).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Worktrees: a worktree root is its own root, and does not match the main one
// ---------------------------------------------------------------------------
describe("worktrees", () => {
  const WORKTREE = `${MAC_ROOT}/.claude/worktrees/feat-x`;

  it("rewrites paths under the worktree it is running in", () => {
    expect(run(`bash ${WORKTREE}/scripts/x.sh`, WORKTREE)).toBe(
      "bash scripts/x.sh"
    );
  });

  it("does not relativize a main-repo path from inside a worktree", () => {
    const cmd = `bash ${MAC_ROOT}/scripts/x.sh`;
    expect(run(cmd, WORKTREE)).toBe(cmd);
  });
});
