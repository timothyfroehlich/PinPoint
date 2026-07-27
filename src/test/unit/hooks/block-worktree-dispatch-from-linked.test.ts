// Unit tests for .claude/hooks/block-worktree-dispatch-from-linked.cjs — the
// PreToolUse hook that blocks Agent(isolation:"worktree") dispatch from inside a
// linked worktree (upstream bug anthropics/claude-code#47548, which silently
// switches the PARENT worktree's branch to the subagent's new branch).
//
// The hook shells out to git for worktree classification, so these tests build
// real repositories in a temp dir: one plain clone (main worktree) and one
// linked worktree created from it. That is the only way to exercise the
// main-vs-linked distinction honestly — mocking it would test the mock.
//
// NOTE: a passing suite here proves the PREDICATE. It does not prove the hook
// fires on a real Agent dispatch; that needs the manual smoke test recorded in
// the PP-22e4 spec (§11).

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-worktree-dispatch-from-linked.cjs"
);

let scratch: string;
let mainRepo: string;
let linkedWorktree: string;

function git(args: string[], cwd: string): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

beforeAll(() => {
  scratch = mkdtempSync(path.join(tmpdir(), "wt-hook-"));
  mainRepo = path.join(scratch, "repo");
  linkedWorktree = path.join(scratch, "linked");

  git(["init", "-b", "main", "repo"], scratch);
  git(["config", "user.email", "test@example.com"], mainRepo);
  git(["config", "user.name", "Test"], mainRepo);
  writeFileSync(path.join(mainRepo, "README.md"), "x\n");
  git(["add", "."], mainRepo);
  git(["commit", "-m", "init"], mainRepo);
  git(["worktree", "add", linkedWorktree, "-b", "feature"], mainRepo);
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function runHook(payload: unknown): { status: number; stderr: string } {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stderr: result.stderr ?? "" };
}

function dispatch(cwd: string, isolation?: string): unknown {
  return {
    tool_name: "Agent",
    cwd,
    tool_input: {
      description: "do a thing",
      prompt: "...",
      ...(isolation === undefined ? {} : { isolation }),
    },
  };
}

describe("block-worktree-dispatch-from-linked.cjs — the blocking case", () => {
  it("blocks worktree dispatch from a LINKED worktree", () => {
    const { status, stderr } = runHook(dispatch(linkedWorktree, "worktree"));
    expect(status).toBe(2);
    expect(stderr).toContain("LINKED worktree");
    expect(stderr).toContain("47548");
    expect(stderr).toContain("main worktree");
  });
});

describe("block-worktree-dispatch-from-linked.cjs — allowed cases", () => {
  it("allows worktree dispatch from the MAIN worktree", () => {
    expect(runHook(dispatch(mainRepo, "worktree")).status).toBe(0);
  });

  it("allows non-isolated dispatch from a linked worktree", () => {
    // Only worktree-isolated dispatch triggers the upstream bug.
    expect(runHook(dispatch(linkedWorktree)).status).toBe(0);
    expect(runHook(dispatch(linkedWorktree, "remote")).status).toBe(0);
  });

  it("allows non-Agent tools even from a linked worktree", () => {
    const payload = {
      tool_name: "Bash",
      cwd: linkedWorktree,
      tool_input: { command: "echo hi", isolation: "worktree" },
    };
    expect(runHook(payload).status).toBe(0);
  });
});

describe("block-worktree-dispatch-from-linked.cjs — fails open", () => {
  it("allows when cwd is not a git repository", () => {
    // "unknown" must allow, not block — the inverse of the sibling hook's
    // collapse-to-false, which would be fail-CLOSED here.
    expect(runHook(dispatch(scratch, "worktree")).status).toBe(0);
  });

  it("allows when cwd does not exist", () => {
    expect(
      runHook(dispatch(path.join(scratch, "nope"), "worktree")).status
    ).toBe(0);
  });

  it("allows a malformed payload", () => {
    const result = spawnSync("node", [hookPath], {
      input: "]]]",
      encoding: "utf8",
    });
    expect(result.status ?? 1).toBe(0);
  });
});

describe("block-worktree-dispatch-from-linked.cjs — worktreeKind()", () => {
  it("classifies main, linked, and unknown", async () => {
    const mod = (await import(hookPath)) as unknown as {
      worktreeKind: (cwd: string) => string;
      isWorktreeDispatch: (payload: unknown) => boolean;
    };
    expect(mod.worktreeKind(mainRepo)).toBe("main");
    expect(mod.worktreeKind(linkedWorktree)).toBe("linked");
    expect(mod.worktreeKind(scratch)).toBe("unknown");

    expect(mod.isWorktreeDispatch(dispatch(mainRepo, "worktree"))).toBe(true);
    expect(mod.isWorktreeDispatch(dispatch(mainRepo))).toBe(false);
    expect(mod.isWorktreeDispatch({ tool_name: "Bash" })).toBe(false);
  });
});
