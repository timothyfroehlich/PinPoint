// Unit tests for .claude/hooks/block-direct-merge.cjs — the PreToolUse hook
// that blocks ALL agent-initiated PR merges (PP-wi85). Merging is human-only:
// there is no agent-usable bypass. The only merge channel is a human typing a
// `!`-prefixed command in Claude Code, which never generates a PreToolUse
// event and so is outside this hook's reach entirely.
//
// Exercises the hook as a subprocess (spawnSync node hookPath, JSON on stdin)
// — matches the pattern used by verify-guard-stack.test.ts.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-direct-merge.cjs"
);

function runHook(payload: unknown): {
  status: number;
  stdout: string;
  stderr: string;
} {
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

function bashPayload(command: string): unknown {
  return { tool_name: "Bash", tool_input: { command } };
}

describe("block-direct-merge.cjs — gh merge paths", () => {
  it("blocks `gh pr merge <PR>`", () => {
    const { status, stderr } = runHook(bashPayload("gh pr merge 123"));
    expect(status).toBe(2);
    expect(stderr).toContain("Direct merge blocked: gh pr merge");
    expect(stderr).toContain("! scripts/workflow/merge-pr.sh <PR> --human");
  });

  it("blocks `gh pr merge` chained after another command", () => {
    const { status, stderr } = runHook(
      bashPayload("git status && gh pr merge 123 --squash")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("Direct merge blocked: gh pr merge");
  });

  it("blocks `gh api PUT .../pulls/N/merge`", () => {
    const { status, stderr } = runHook(
      bashPayload("gh api -X PUT repos/o/r/pulls/123/merge")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("gh api PUT .../merge");
  });

  it("does not block gh api GET on a pulls/N/merge path (no write method)", () => {
    const { status } = runHook(bashPayload("gh api repos/o/r/pulls/123/merge"));
    expect(status).toBe(0);
  });

  it("passes through `gh pr merge --help`", () => {
    const { status } = runHook(bashPayload("gh pr merge --help"));
    expect(status).toBe(0);
  });

  it("does not block an unrelated gh command", () => {
    const { status } = runHook(bashPayload("gh pr view 123"));
    expect(status).toBe(0);
  });
});

describe("block-direct-merge.cjs — MCP merge", () => {
  it("blocks mcp__github__merge_pull_request regardless of tool_input", () => {
    const { status, stderr } = runHook({
      tool_name: "mcp__github__merge_pull_request",
      tool_input: { owner: "o", repo: "r", pullNumber: 123 },
    });
    expect(status).toBe(2);
    expect(stderr).toContain("MCP merge_pull_request");
  });
});

describe("block-direct-merge.cjs — merge-pr.sh (PP-wi85 hard gate)", () => {
  it("blocks a bare `merge-pr.sh <PR>` invocation", () => {
    const { status, stderr } = runHook(bashPayload("merge-pr.sh 123"));
    expect(status).toBe(2);
    expect(stderr).toContain(
      "Merge is human-only. You cannot run merge-pr.sh."
    );
  });

  it("blocks `bash scripts/workflow/merge-pr.sh <PR>`", () => {
    const { status, stderr } = runHook(
      bashPayload("bash scripts/workflow/merge-pr.sh 123")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("Merge is human-only.");
  });

  it("blocks `./scripts/workflow/merge-pr.sh <PR>`", () => {
    const { status, stderr } = runHook(
      bashPayload("./scripts/workflow/merge-pr.sh 123")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("Merge is human-only.");
  });

  it("blocks an absolute-path invocation", () => {
    const { status } = runHook(
      bashPayload(
        "/Users/tim/PinPoint/scripts/workflow/merge-pr.sh 123 --human"
      )
    );
    expect(status).toBe(2);
  });

  it("blocks `sh scripts/workflow/merge-pr.sh <PR>`", () => {
    const { status } = runHook(
      bashPayload("sh scripts/workflow/merge-pr.sh 123")
    );
    expect(status).toBe(2);
  });

  it("blocks chained after another command", () => {
    const { status } = runHook(
      bashPayload("pnpm run check && scripts/workflow/merge-pr.sh 123 --human")
    );
    expect(status).toBe(2);
  });

  it("blocks a bare leading VAR=val assignment (no env wrapper)", () => {
    // Regression: the original regex only tolerated `env VAR=val ...`, so a
    // bare shell assignment like `DUMMY=1 scripts/workflow/merge-pr.sh ...`
    // slipped through the hard gate entirely.
    const { status } = runHook(
      bashPayload("DUMMY=1 scripts/workflow/merge-pr.sh 123 --human")
    );
    expect(status).toBe(2);
  });

  it("blocks `env VAR=val bash scripts/workflow/merge-pr.sh <PR>`", () => {
    const { status } = runHook(
      bashPayload("env FOO=bar bash scripts/workflow/merge-pr.sh 123")
    );
    expect(status).toBe(2);
  });

  it("does NOT block a quoted mention (echo)", () => {
    const { status } = runHook(
      bashPayload('echo "run merge-pr.sh when ready"')
    );
    expect(status).toBe(0);
  });

  it("does NOT block a quoted mention (rg/docs search)", () => {
    const { status } = runHook(
      bashPayload('rg "merge-pr.sh" docs/superpowers/specs/')
    );
    expect(status).toBe(0);
  });

  it("does NOT block an unrelated command", () => {
    const { status } = runHook(bashPayload("gh pr view 123"));
    expect(status).toBe(0);
  });

  it("does NOT block dry-run mention text inside a single-quoted string", () => {
    const { status } = runHook(
      bashPayload(
        "echo 'canonical command: scripts/workflow/merge-pr.sh <PR> --human'"
      )
    );
    expect(status).toBe(0);
  });
});

describe("block-direct-merge.cjs — no bypass sentinel", () => {
  it("still blocks merge-pr.sh even with a stray .claude-merge-bypass-shaped arg", () => {
    // PP-wi85 removed the bypass sentinel entirely — the hook no longer reads
    // any filesystem state, so there is nothing for a sentinel file to flip.
    const { status } = runHook(
      bashPayload(
        "touch .claude-merge-bypass && scripts/workflow/merge-pr.sh 123"
      )
    );
    expect(status).toBe(2);
  });
});

describe("block-direct-merge.cjs — fail-open contract", () => {
  it("malformed JSON on stdin → exit 0", () => {
    const result = spawnSync("node", [hookPath], {
      input: "{not json",
      encoding: "utf8",
    });
    expect(result.status ?? 1).toBe(0);
  });

  it("non-Bash, non-merge tool → exit 0", () => {
    const { status } = runHook({
      tool_name: "Read",
      tool_input: { file_path: "/tmp/x" },
    });
    expect(status).toBe(0);
  });
});
