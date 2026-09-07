import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-direct-pr-watch.cjs"
);
const { classifyCommand, commandFromPayload } = require(hookPath) as {
  classifyCommand: (command: string) => { block: boolean; detail: string };
  commandFromPayload: (payload: unknown) => string;
};

function runHook(payload: unknown) {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("block-direct-pr-watch classifier", () => {
  it.each([
    "./scripts/workflow/pr-watch.py 2068",
    "python3 scripts/workflow/pr-watch.py 2068 --force",
    "python3 scripts/workflow/pr-watch.py 2068 --phase ci --expected-head abc --json",
    "mise exec -- python3 scripts/workflow/pr-watch.py 2068 --phase ci",
    "uv run python3 scripts/workflow/pr-watch.py 2068 --phase review",
    'eval "python3 scripts/workflow/pr-watch.py 2068 --phase=review"',
    "git status && ./scripts/workflow/pr-watch.py 2068",
  ])("blocks a direct lifecycle wait: %s", (command) => {
    expect(classifyCommand(command).block).toBe(true);
  });

  it.each([
    "./scripts/workflow/pr-watch.py 2068 --check-ready",
    "python3 scripts/workflow/pr-watch.py --check-ready 2068",
    "./scripts/workflow/pr-watch.py --help",
    "python3 -m pytest scripts/tests/test_pr_watch.py",
    'echo "run pr-watch.py after pushing"',
  ])("allows diagnostics and non-invocations: %s", (command) => {
    expect(classifyCommand(command).block).toBe(false);
  });
});

describe("cross-harness payloads", () => {
  const command = "python3 scripts/workflow/pr-watch.py 2068";

  it.each([
    { tool_name: "Bash", tool_input: { command } },
    { tool_name: "exec_command", tool_input: { cmd: command } },
  ])("extracts and blocks Claude/Codex shell payloads", (payload) => {
    expect(commandFromPayload(payload)).toBe(command);
    const result = runHook(payload);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("pr-lifecycle-watcher");
    expect(result.stderr).toContain("expected_head");
  });

  it("returns Antigravity's documented deny response", () => {
    const payload = {
      toolCall: { name: "run_command", args: { CommandLine: command } },
    };
    expect(commandFromPayload(payload)).toBe(command);
    const result = runHook(payload);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      decision: "deny",
      reason: expect.stringContaining("pr-lifecycle-watcher"),
    });
  });

  it("fails open for malformed and unrelated payloads", () => {
    expect(runHook({ tool_name: "Read", tool_input: {} }).status).toBe(0);
    const malformed = spawnSync("node", [hookPath], {
      input: "not json",
      encoding: "utf8",
    });
    expect(malformed.status).toBe(0);
  });
});
