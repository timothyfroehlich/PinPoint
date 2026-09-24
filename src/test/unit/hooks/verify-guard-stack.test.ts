// Tests for .claude/hooks/verify-guard-stack.cjs — the SessionStart canary.
// The hook resolves settings.json and hook scripts relative to its own file,
// so each case copies it into a scratch `.claude/hooks/` beside a fixture
// settings.json and spawns it. Warnings go to stdout; the hook always exits 0.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/verify-guard-stack.cjs"
);

const MERGE_DENY = [
  "Bash(gh pr merge*)",
  "Bash(gh api *pulls/*/merge*)",
  "Bash(gh api *mergePullRequest*)",
  "Bash(gh api *enablePullRequestAutoMerge*)",
  "mcp__github__merge_pull_request",
  "mcp__github__enable_pr_auto_merge",
];

const WIRED = {
  SessionStart: [
    {
      hooks: [
        {
          type: "command",
          command:
            'node "${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/verify-guard-stack.cjs',
        },
      ],
    },
  ],
};

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function run(hook: string): { status: number | null; stdout: string } {
  const result = spawnSync("node", [hook], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout };
}

function runWith(settings: string): { status: number | null; stdout: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guard-stack-"));
  tmpDirs.push(root);
  const hook = path.join(root, ".claude", "hooks", "verify-guard-stack.cjs");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.copyFileSync(hookPath, hook);
  fs.writeFileSync(path.join(root, ".claude", "settings.json"), settings);
  return run(hook);
}

describe("verify-guard-stack.cjs", () => {
  it("is silent when wired scripts exist and the merge denies are present", () => {
    const result = runWith(
      JSON.stringify({ hooks: WIRED, permissions: { deny: MERGE_DENY } })
    );
    expect(result).toEqual({ status: 0, stdout: "" });
  });

  it("reports a wired hook script missing from disk", () => {
    const hooks = {
      ...WIRED,
      PreToolUse: [
        { hooks: [{ command: "node .claude/hooks/deleted-guard.cjs" }] },
      ],
    };
    const result = runWith(
      JSON.stringify({ hooks, permissions: { deny: MERGE_DENY } })
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "hook scripts missing from disk: .claude/hooks/deleted-guard.cjs"
    );
  });

  it("reports a missing merge deny rule", () => {
    const deny = MERGE_DENY.filter((rule) => rule !== "Bash(gh pr merge*)");
    const result = runWith(
      JSON.stringify({ hooks: WIRED, permissions: { deny } })
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "merge deny rules missing from permissions.deny: Bash(gh pr merge*)"
    );
  });

  it("reports an unreadable settings.json", () => {
    const result = runWith("{not json");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("cannot check .claude/settings.json");
  });

  it("finds the checked-in .claude/settings.json healthy", () => {
    expect(run(hookPath)).toEqual({ status: 0, stdout: "" });
  });
});
