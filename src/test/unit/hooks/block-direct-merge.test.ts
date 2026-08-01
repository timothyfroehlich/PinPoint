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

// ---------------------------------------------------------------------------
// Wrapper bypasses (PP-6t3c finding A, PP-ar8a).
//
// Every row below EXITED 0 on main. The hook regexed a quote-stripped copy of
// the command against a short hardcoded wrapper list, so wrapping the merge in
// `eval`/`sh -c` erased the payload entirely and `env`/`time`/`xargs` were
// simply not in the list. That defeated PP-wi85 — merging is human-only via
// ANY path — for any agent that wrapped the command, accidentally or not.
//
// This is main's first regression suite for a guard caught misfiring: both
// earlier attempts (#1736, #1738) were closed before merge, so the lesson only
// ever lived in commit messages.
// ---------------------------------------------------------------------------
describe("block-direct-merge.cjs — wrapped invocations (PP-6t3c, PP-ar8a)", () => {
  it.each([
    'eval "gh pr merge 123 --squash"',
    "eval 'gh pr merge 123'",
    'sh -c "gh pr merge 123"',
    'bash -c "gh pr merge 123"',
    'zsh -c "gh pr merge 123"',
    "env gh pr merge 123",
    "time gh pr merge 123",
    "command gh pr merge 123",
    "nice gh pr merge 123",
    "sudo gh pr merge 123",
    "timeout 60 gh pr merge 123",
    "xargs -I{} gh pr merge {} < prs.txt",
    "GH_TOKEN=x gh pr merge 123",
    "$(echo gh) pr merge 123",
    "`gh pr merge 123`",
  ])("blocks %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
  });

  it.each([
    'eval "scripts/workflow/merge-pr.sh 123 --human"',
    'sh -c "scripts/workflow/merge-pr.sh 123 --human"',
    'bash -c "./scripts/workflow/merge-pr.sh 123"',
    "env scripts/workflow/merge-pr.sh 123",
    "time scripts/workflow/merge-pr.sh 123",
    "xargs -I{} scripts/workflow/merge-pr.sh {}",
    "sudo -u root scripts/workflow/merge-pr.sh 123",
  ])("blocks %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
  });

  it.each([
    'eval "gh api -X PUT repos/o/r/pulls/123/merge"',
    'sh -c "gh api --method PUT repos/o/r/pulls/123/merge"',
    "env gh api -X POST repos/o/r/pulls/123/merge",
  ])("blocks %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
  });

  it.each([
    "gh -R owner/repo pr merge 123",
    "gh pr --repo owner/repo merge 123",
    "gh --repo=owner/repo pr merge 123",
  ])("blocks %s (repo selector between gh and its subcommand)", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
  });

  it("does NOT block `gh pr list` with a quoted search naming a merge", () => {
    const { status } = runHook(
      bashPayload('gh pr list --search "pr merge blocked"')
    );
    expect(status).toBe(0);
  });

  it("blocks `gh api --method=PUT` (attached flag value)", () => {
    const { status } = runHook(
      bashPayload("gh api --method=PUT repos/o/r/pulls/123/merge")
    );
    expect(status).toBe(2);
  });

  it("blocks a merge chained behind a --help on a DIFFERENT segment", () => {
    // The old prefix gate tested `--help` against the WHOLE command, so one
    // `--help` anywhere disarmed every gh check in the command.
    const { status } = runHook(
      bashPayload("gh pr view --help && gh pr merge 123")
    );
    expect(status).toBe(2);
  });

  it("blocks a merge on a later LINE of a multi-line command", () => {
    const { status } = runHook(
      bashPayload("git fetch origin\ngh pr merge 123 --squash")
    );
    expect(status).toBe(2);
  });

  it("blocks when the command is unresolvable but names a merge", () => {
    // `eval "$CMD"` cannot be resolved statically. On a hard boundary an
    // unknowable command is suspicious, not safe, so the raw text is scanned.
    const { status } = runHook(
      bashPayload('CMD="gh pr merge 123"; eval "$CMD"')
    );
    expect(status).toBe(2);
  });

  it("does NOT block an unresolvable command with no merge indicator", () => {
    const { status } = runHook(bashPayload('eval "$EDITOR notes.md"'));
    expect(status).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Prose must still pass. A guard that blocks the words is as broken as one
// that misses the command — agents legitimately write these every session.
// ---------------------------------------------------------------------------
describe("block-direct-merge.cjs — prose mentions still pass", () => {
  it.each([
    'echo "run merge-pr.sh when ready"',
    "echo 'hand Tim: scripts/workflow/merge-pr.sh <PR> --human'",
    'rg "gh pr merge" docs/',
    'bd comments add PP-x "ready to merge — gh pr merge is human-only"',
    'git commit -m "docs: explain why gh pr merge is blocked"',
    "gh pr merge --help",
    "gh api repos/o/r/pulls/123/merge",
    "gh pr view 123",
  ])("allows %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(0);
  });

  it("allows a heredoc whose BODY names the merge command", () => {
    const { status } = runHook(
      bashPayload(
        [
          "cat > /tmp/handoff.md <<'EOF'",
          "gh pr merge 123 --squash",
          "scripts/workflow/merge-pr.sh 123 --human",
          "EOF",
        ].join("\n")
      )
    );
    expect(status).toBe(0);
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
