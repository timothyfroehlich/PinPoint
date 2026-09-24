// Table-driven tests for .claude/hooks/block-main-worktree-branch-switch.cjs:
// spawn the hook with a PreToolUse payload against a scratch repo's main
// worktree and a linked worktree, and assert the exit code.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-main-worktree-branch-switch.cjs"
);

let root = "";
let linked = "";

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "branch-switch-hook-"));
  linked = `${root}-linked`;
  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: root, stdio: "ignore" });
  };
  git("init", "-q", "-b", "main");
  git(
    "-c",
    "user.email=test@example.com",
    "-c",
    "user.name=Test",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "base"
  );
  git("worktree", "add", "-q", "-b", "feature", linked);
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(linked, { recursive: true, force: true });
});

function runHook(
  command: string,
  cwd: string,
  toolName = "Bash"
): { status: number | null; stderr: string } {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify({
      tool_name: toolName,
      tool_input: { command },
      cwd,
    }),
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr };
}

const BLOCKED = [
  "git checkout feature/x",
  "git switch feature/x",
  "git checkout -b topic",
  "git switch -c topic",
  "git checkout -",
  "git switch --detach",
  "git checkout origin/main",
  "git status && git checkout feature/x",
  "echo $(git switch feature/x)",
];

const ALLOWED = [
  "git checkout main",
  'git switch "main"',
  "git checkout -- src/a.ts",
  "git checkout HEAD~1 -- src/a.ts",
  "git checkout --theirs src/a.ts",
  "git checkout --ours src/a.ts",
  "git checkout -p src/a.ts",
  "git checkout .",
  "cd ../other && git checkout feature/x",
  "git -C ../other checkout feature/x",
  "echo git checkout feature/x",
  "rg 'git checkout feature/x' docs",
  "git status",
];

describe("block-main-worktree-branch-switch.cjs in the main worktree", () => {
  it.each(BLOCKED)("blocks %s", (command) => {
    const { status, stderr } = runHook(command, root);
    expect(status).toBe(2);
    expect(stderr).toContain("Branch switch blocked in the MAIN worktree");
  });

  it.each(ALLOWED)("allows %s", (command) => {
    expect(runHook(command, root).status).toBe(0);
  });

  it("allows a non-Bash tool", () => {
    expect(runHook("git checkout feature/x", root, "Read").status).toBe(0);
  });

  it("allows a malformed payload", () => {
    const result = spawnSync("node", [hookPath], {
      input: "{not json",
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
  });
});

describe("block-main-worktree-branch-switch.cjs in a linked worktree", () => {
  it("allows a branch switch", () => {
    expect(runHook("git checkout feature/x", linked).status).toBe(0);
  });
});
