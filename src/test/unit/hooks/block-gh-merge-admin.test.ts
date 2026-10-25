// Table-driven tests for .claude/hooks/block-gh-merge-admin.cjs: spawn the hook
// with a PreToolUse payload and assert whether it blocks (exit 2).

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-gh-merge-admin.cjs"
);

function run(command: string, toolName = "Bash"): number | null {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify({ tool_name: toolName, tool_input: { command } }),
    encoding: "utf8",
  });
  return result.status;
}

describe("block-gh-merge-admin hook", () => {
  it.each([
    "gh pr merge 12 --admin",
    "gh pr merge 12 --squash --admin",
    'gh pr merge 12 --ad""min',
    "gh pr merge 12 --ad'm'in",
    "gh pr merge 12 --adm\\in",
    "gh pr merge 12 $'--admin'",
    "F=--admin; gh pr merge 12 $F",
    "gh pr merge 12 $(cat flag.txt)",
    "gh pr merge 12 `cat flag.txt`",
    "echo --squash | xargs gh pr merge 12",
    'eval "gh pr merge 12 --squash"',
    "gh pr -R timothyfroehlich/PinPoint merge 12 --admin",
    "cd /tmp && gh pr merge 12 --admin",
    "GH pr merge 12 --admin",
    "Gh pr merge 12 --squash $F",
    "g? pr merge 12 --admin",
    "gh pr merge 12 --ad\\\nmin",
    "gh pr merge 12 \\\n  --admin",
    "gh alias set m 'pr merge --admin'",
    "gh alias import aliases.yml",
    "gh m 12 --admin",
  ])("blocks %s", (command) => {
    expect(run(command)).toBe(2);
  });

  it.each([
    "gh pr merge 12 --squash",
    "gh pr merge 12 --auto --squash",
    "gh pr merge 2543 --squash --delete-branch",
    "gh pr view 12 --json mergeStateStatus",
    "git merge origin/main",
    "gh pr update-branch 12",
    'echo "$HOME" && gh pr checks 12 --required',
  ])("allows %s", (command) => {
    expect(run(command)).not.toBe(2);
  });

  it("ignores other tools and malformed payloads", () => {
    expect(run("gh pr merge 12 --admin", "Read")).not.toBe(2);
    const result = spawnSync("node", [hookPath], {
      input: "not json",
      encoding: "utf8",
    });
    expect(result.status).not.toBe(2);
  });
});
