// Unit tests for the `classifyCommand` classifier exported from
// .claude/hooks/block-main-worktree-branch-switch.cjs.
//
// The classifier is pure (no git/fs I/O) so these tests run without any
// external dependencies. They cover the fix for the false-positive where
// `tokens.indexOf("git")` treated ANY segment containing `git` as a git
// invocation — even when `git` was only an argument.

import { createRequire } from "node:module";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Resolve the hook relative to the repo root (process.cwd() in vitest).
const require = createRequire(import.meta.url);
const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-main-worktree-branch-switch.cjs"
);
const { classifyCommand } = require(hookPath) as {
  classifyCommand: (cmd: string) => { block: boolean; detail: string };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function expectBlock(cmd: string) {
  const result = classifyCommand(cmd);
  expect(result.block, `Expected BLOCK for: ${JSON.stringify(cmd)}`).toBe(true);
  return result;
}

function expectAllow(cmd: string) {
  const result = classifyCommand(cmd);
  expect(result.block, `Expected ALLOW for: ${JSON.stringify(cmd)}`).toBe(
    false
  );
  return result;
}

// ---------------------------------------------------------------------------
// Direct git invocations — must BLOCK
// ---------------------------------------------------------------------------
describe("direct git invocations → BLOCK", () => {
  it("blocks git checkout <branch>", () => {
    expectBlock("git checkout feature/x");
  });

  it("blocks git switch -c <branch>", () => {
    expectBlock("git switch -c foo");
  });

  it("blocks git switch <branch>", () => {
    expectBlock("git switch my-branch");
  });

  it("blocks git checkout - (previous branch)", () => {
    expectBlock("git checkout -");
  });

  it("blocks git checkout -b <branch>", () => {
    expectBlock("git checkout -b new-branch");
  });
});

// ---------------------------------------------------------------------------
// Wrapper / env-prefixed real git invocations — must still BLOCK
// ---------------------------------------------------------------------------
describe("wrapper/env-prefixed real git invocations → BLOCK", () => {
  it("blocks FOO=1 git checkout x (env assignment prefix)", () => {
    expectBlock("FOO=1 git checkout x");
  });

  it("blocks env FOO=1 git checkout x (env wrapper)", () => {
    expectBlock("env FOO=1 git checkout x");
  });

  it("blocks sudo git checkout x (sudo wrapper)", () => {
    expectBlock("sudo git checkout x");
  });

  it("blocks time git switch x (time wrapper)", () => {
    expectBlock("time git switch x");
  });

  it("blocks nice git checkout branch (nice wrapper)", () => {
    expectBlock("nice git checkout branch");
  });

  it("blocks command git checkout branch (command wrapper)", () => {
    expectBlock("command git checkout branch");
  });

  it("blocks multiple env vars before git checkout", () => {
    expectBlock("FOO=1 BAR=2 git checkout mybranch");
  });
});

// ---------------------------------------------------------------------------
// git-as-argument (false-positive fix) — must ALLOW
// ---------------------------------------------------------------------------
describe("git as argument, not command → ALLOW (false-positive fix)", () => {
  it("allows echo git checkout feature/x", () => {
    expectAllow("echo git checkout feature/x");
  });

  it("allows rg git checkout", () => {
    expectAllow("rg git checkout");
  });

  it("allows grep -r git checkout src/", () => {
    expectAllow("grep -r git checkout src/");
  });

  it("allows cat file | grep 'git checkout'", () => {
    // The pipe splits into segments; the second is `grep 'git checkout'`
    // whose resolved command is `grep`, not `git`.
    expectAllow("cat file | grep 'git checkout'");
  });
});

// ---------------------------------------------------------------------------
// Legitimate git commands that must ALLOW
// ---------------------------------------------------------------------------
describe("legitimate git commands → ALLOW", () => {
  it("allows git checkout main", () => {
    expectAllow("git checkout main");
  });

  it("allows git switch main", () => {
    expectAllow("git switch main");
  });

  it('allows git checkout "main" (quoted)', () => {
    expectAllow('git checkout "main"');
  });

  it("allows git checkout -- somefile (file restore)", () => {
    expectAllow("git checkout -- somefile");
  });

  it("allows git log --grep 'checkout feature' (git is command but no checkout/switch subcommand)", () => {
    expectAllow("git log --grep 'checkout feature'");
  });

  it("allows git status", () => {
    expectAllow("git status");
  });
});

// ---------------------------------------------------------------------------
// Compound commands (&&, ||, ;) — block if ANY segment is a branch switch
// ---------------------------------------------------------------------------
describe("compound commands → BLOCK if any segment switches", () => {
  it("blocks 'git status && git checkout feature/x'", () => {
    expectBlock("git status && git checkout feature/x");
  });

  it("blocks 'echo hello; git switch mybranch'", () => {
    expectBlock("echo hello; git switch mybranch");
  });

  it("allows 'echo git checkout x && git status' (only echo+git-status in segments)", () => {
    // echo git checkout x → ALLOW (echo is command)
    // git status          → ALLOW (no checkout/switch subcommand)
    expectAllow("echo git checkout x && git status");
  });
});
