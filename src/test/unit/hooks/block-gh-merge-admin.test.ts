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
    "g* pr merge 12 --squash",
    "{gh,x} pr merge 12 --squash",
    "~/bin/gh pr merge 12 --squash",
    "$GH pr merge 12 --squash",
    "env FOO=1 gh pr merge 12 --squash --body x",
    'bash -c "gh pr merge 12 --squash"',
    "gh pr merge 12 --squash --repo other/repo",
    "nice gh pr merge 12 $F",
    "timeout 30 gh pr merge 12 --squash --body x",
    "/usr/bin/nice -n 5 /opt/homebrew/bin/gh pr merge 12 --body x",
    "doas -u tim gh pr merge 12 --squash --subject x",
    "git -c alias.x='!gh pr merge 12 $F' x",
    "rg --pre 'gh pr merge 12' merge docs",
    "grep merge $(gh pr merge 12 --body x)",
    "echo ok; gh alias set m 'pr merge'",
    "! gh pr merge 12 --body x",
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
    "  gh pr merge 12 --squash  ",
    "cd /tmp && gh pr merge 12 --auto --squash",
    "grep -n merge src/file.ts",
    "rg --hidden 'gh pr merge' docs",
    "grep -rn 'gh pr merge' .agents/skills/*/SKILL.md",
    "git merge --no-edit origin/main",
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
