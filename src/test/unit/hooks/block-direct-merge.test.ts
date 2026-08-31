// Unit tests for .claude/hooks/block-direct-merge.cjs — the PreToolUse hook that
// governs agent-initiated PinPoint PR merges. Explicit targets in other
// repositories follow their own policy. Two outcomes, by channel (PP-wi85
// reversed for the script only, per Tim 2026-08-19):
//   - merge-pr.sh (the gate-enforced script) → ASK: exit 0 with a PreToolUse
//     "ask" decision on stdout, so Tim approves the prompt before it runs.
//   - gh pr merge / gh api PUT .../merge / MCP merge_pull_request → DENY: exit 2,
//     stderr message. These skip merge-pr.sh's gate checks, so they stay
//     human-only-via-`!` (a `!`-prefixed human command never fires PreToolUse).
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

/** Assert the hook emitted a PreToolUse "ask" decision (exit 0 + stdout JSON). */
function expectAsk(result: { status: number; stdout: string }): void {
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout) as {
    hookSpecificOutput?: {
      hookEventName?: string;
      permissionDecision?: string;
      permissionDecisionReason?: string;
    };
  };
  expect(parsed.hookSpecificOutput?.hookEventName).toBe("PreToolUse");
  expect(parsed.hookSpecificOutput?.permissionDecision).toBe("ask");
  expect(parsed.hookSpecificOutput?.permissionDecisionReason).toContain(
    "merge-pr.sh"
  );
}

/** Assert the hook passed the command through (exit 0, no decision on stdout). */
function expectAllow(result: { status: number; stdout: string }): void {
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("");
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
      bashPayload(
        "gh api -X PUT repos/timothyfroehlich/PinPoint/pulls/123/merge"
      )
    );
    expect(status).toBe(2);
    expect(stderr).toContain("gh api PUT .../merge");
  });

  it.each([
    "gh api -XPUT repos/timothyfroehlich/PinPoint/pulls/123/merge",
    'gh api -X "$METHOD" repos/timothyfroehlich/PinPoint/pulls/123/merge',
    'gh api --method="$METHOD" repos/timothyfroehlich/PinPoint/pulls/123/merge',
    "gh api -X$METHOD repos/timothyfroehlich/PinPoint/pulls/123/merge",
  ])("blocks an attached or dynamic REST method selector: %s", (command) => {
    expect(runHook(bashPayload(command)).status).toBe(2);
  });

  it("fails closed on a dynamic REST endpoint despite a dotfiles-shaped input filename", () => {
    const { status } = runHook(
      bashPayload(
        'gh api -X PUT "repos/$TARGET/pulls/123/merge" --input repos/timothyfroehlich/dotfiles/pulls/4/merge'
      )
    );
    expect(status).toBe(2);
  });

  it.each([
    "gh pr merge 4 --repo timothyfroehlich/dotfiles --squash",
    "gh -R timothyfroehlich/dotfiles pr merge 4 --squash",
    "gh pr merge https://github.com/timothyfroehlich/dotfiles/pull/4 --squash",
    "gh api -X PUT repos/timothyfroehlich/dotfiles/pulls/4/merge",
    "gh api -XPUT repos/timothyfroehlich/dotfiles/pulls/4/merge",
    'gh api -X "$METHOD" repos/timothyfroehlich/dotfiles/pulls/4/merge',
    "gh api -X PUT repos/timothyfroehlich/dotfiles/pulls/4/merge --input repos/timothyfroehlich/PinPoint/pulls/123/merge",
    "GH_REPO=timothyfroehlich/PinPoint gh pr merge 4 --repo timothyfroehlich/dotfiles",
    'gh pr merge 4 --repo timothyfroehlich/dotfiles --body "$(printf note)"',
    'gh pr merge 4 --body "$BODY" --repo timothyfroehlich/dotfiles',
    'gh api --input "$FILE" -X PUT repos/timothyfroehlich/dotfiles/pulls/4/merge',
  ])("allows an explicit non-PinPoint target: %s", (command) => {
    expectAllow(runHook(bashPayload(command)));
  });

  it.each([
    'gh pr merge 4 --repo "$TARGET_REPOSITORY" --squash',
    "gh pr merge https://github.com/timothyfroehlich/PinPoint/pull/123 --repo timothyfroehlich/dotfiles",
    "GH_REPO=timothyfroehlich/dotfiles gh pr merge 123 --squash",
    "env GH_REPO=timothyfroehlich/dotfiles gh pr merge 123 --squash",
    "env GH_REPO=timothyfroehlich/dotfiles sh -c 'unset GH_REPO; gh pr merge 123'",
    "gh pr merge 123 --body https://github.com/timothyfroehlich/dotfiles/pull/4",
    "gh pr merge 123 --body repos/timothyfroehlich/dotfiles/pulls/4/merge",
    "gh pr merge 123 --repo timothyfroehlich/Pin$(printf Point)",
    "gh pr merge 123 --body --repo=timothyfroehlich/dotfiles",
    "FLAG=--body; gh pr merge 123 $FLAG --repo=timothyfroehlich/dotfiles",
    "gh api $FLAG -X PUT repos/timothyfroehlich/dotfiles/pulls/4/merge",
  ])("fails closed on an ambiguous repository target: %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
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
  it("blocks mcp__github__merge_pull_request for PinPoint", () => {
    const { status, stderr } = runHook({
      tool_name: "mcp__github__merge_pull_request",
      tool_input: {
        owner: "timothyfroehlich",
        repo: "PinPoint",
        pullNumber: 123,
      },
    });
    expect(status).toBe(2);
    expect(stderr).toContain("MCP merge_pull_request");
  });

  it("allows mcp__github__merge_pull_request for an explicit other repo", () => {
    expectAllow(
      runHook({
        tool_name: "mcp__github__merge_pull_request",
        tool_input: {
          owner: "timothyfroehlich",
          repo: "dotfiles",
          pullNumber: 4,
        },
      })
    );
  });

  it("fails closed when the MCP repository target is missing", () => {
    const { status } = runHook({
      tool_name: "mcp__github__merge_pull_request",
      tool_input: { pullNumber: 123 },
    });
    expect(status).toBe(2);
  });
});

describe("block-direct-merge.cjs — merge-pr.sh (PP-wi85 ask-gated)", () => {
  // merge-pr.sh is the gate-enforced script; an agent MAY invoke it, and the
  // hook turns each invocation into an approval prompt (exit 0 + "ask" JSON) so
  // Tim signs off. Every shape below still has to be RECOGNIZED as merge-pr.sh —
  // a wrapper/path form that slips past recognition would reach the merge
  // un-prompted, so these are the same evasion cases the old hard gate covered,
  // now asserting ask instead of deny.
  it("asks on a bare `merge-pr.sh <PR>` invocation", () => {
    expectAsk(runHook(bashPayload("merge-pr.sh 123")));
  });

  it("asks on `bash scripts/workflow/merge-pr.sh <PR>`", () => {
    expectAsk(runHook(bashPayload("bash scripts/workflow/merge-pr.sh 123")));
  });

  it("asks on `./scripts/workflow/merge-pr.sh <PR>`", () => {
    expectAsk(runHook(bashPayload("./scripts/workflow/merge-pr.sh 123")));
  });

  it("asks on an absolute-path invocation", () => {
    expectAsk(
      runHook(
        bashPayload(
          "/Users/tim/PinPoint/scripts/workflow/merge-pr.sh 123 --human"
        )
      )
    );
  });

  it("asks on `sh scripts/workflow/merge-pr.sh <PR>`", () => {
    expectAsk(runHook(bashPayload("sh scripts/workflow/merge-pr.sh 123")));
  });

  it("asks when chained after another command", () => {
    expectAsk(
      runHook(
        bashPayload(
          "pnpm run check && scripts/workflow/merge-pr.sh 123 --human"
        )
      )
    );
  });

  it("asks on a bare leading VAR=val assignment (no env wrapper)", () => {
    // Regression: the original regex only tolerated `env VAR=val ...`, so a
    // bare shell assignment like `DUMMY=1 scripts/workflow/merge-pr.sh ...`
    // slipped past recognition entirely.
    expectAsk(
      runHook(bashPayload("DUMMY=1 scripts/workflow/merge-pr.sh 123 --human"))
    );
  });

  it("asks on `env VAR=val bash scripts/workflow/merge-pr.sh <PR>`", () => {
    expectAsk(
      runHook(bashPayload("env FOO=bar bash scripts/workflow/merge-pr.sh 123"))
    );
  });

  it("does NOT act on a quoted mention (echo)", () => {
    expectAllow(runHook(bashPayload('echo "run merge-pr.sh when ready"')));
  });

  it("does NOT act on a quoted mention (rg/docs search)", () => {
    expectAllow(
      runHook(bashPayload('rg "merge-pr.sh" docs/superpowers/specs/'))
    );
  });

  it("does NOT act on an unrelated command", () => {
    expectAllow(runHook(bashPayload("gh pr view 123")));
  });

  it("does NOT act on dry-run mention text inside a single-quoted string", () => {
    expectAllow(
      runHook(
        bashPayload(
          "echo 'canonical command: scripts/workflow/merge-pr.sh <PR> --human'"
        )
      )
    );
  });
});

describe("block-direct-merge.cjs — no bypass sentinel", () => {
  it("still recognizes merge-pr.sh even with a stray .claude-merge-bypass-shaped arg", () => {
    // PP-wi85 removed the bypass sentinel entirely — the hook reads no
    // filesystem state, so there is nothing for a sentinel file to flip. The
    // chained merge-pr.sh is still recognized and prompts for approval.
    expectAsk(
      runHook(
        bashPayload(
          "touch .claude-merge-bypass && scripts/workflow/merge-pr.sh 123"
        )
      )
    );
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

  // merge-pr.sh is ask-gated: a wrapped invocation must still be recognized so
  // it prompts (exit 0 + "ask") rather than slipping through un-prompted.
  it.each([
    'eval "scripts/workflow/merge-pr.sh 123 --human"',
    'sh -c "scripts/workflow/merge-pr.sh 123 --human"',
    'bash -c "./scripts/workflow/merge-pr.sh 123"',
    "env scripts/workflow/merge-pr.sh 123",
    "time scripts/workflow/merge-pr.sh 123",
    "xargs -I{} scripts/workflow/merge-pr.sh {}",
    "sudo -u root scripts/workflow/merge-pr.sh 123",
  ])("asks on %s", (command) => {
    expectAsk(runHook(bashPayload(command)));
  });

  it.each([
    'eval "gh api -X PUT repos/timothyfroehlich/PinPoint/pulls/123/merge"',
    'sh -c "gh api --method PUT repos/timothyfroehlich/PinPoint/pulls/123/merge"',
    "env gh api -X POST repos/timothyfroehlich/PinPoint/pulls/123/merge",
  ])("blocks %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
  });

  it.each([
    "gh -R timothyfroehlich/PinPoint pr merge 123",
    "gh pr --repo timothyfroehlich/PinPoint merge 123",
    "gh --repo=timothyfroehlich/PinPoint pr merge 123",
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
      bashPayload(
        "gh api --method=PUT repos/timothyfroehlich/PinPoint/pulls/123/merge"
      )
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

describe("block-direct-merge.cjs — shell control words (PP-c8xa)", () => {
  it.each([
    "if gh pr merge 123; then echo blocked; fi",
    "! gh pr merge 123",
    "{ gh pr merge 123; }",
    "while gh pr merge 123; do echo blocked; done",
    "function guarded { gh pr merge 123; }; guarded",
    "coproc gh pr merge 123",
    "coproc guarded { gh pr merge 123; }",
    "time if gh pr merge 123; then echo blocked; fi",
    "time { gh pr merge 123; }",
    "time function guarded { gh pr merge 123; }; guarded",
    "time coproc gh pr merge 123",
    "time coproc guarded { gh pr merge 123; }",
    "coproc guarded if gh pr merge 123; then :; fi",
    "coproc guarded while gh pr merge 123; do :; done",
    "coproc guarded until gh pr merge 123; do :; done",
    "time coproc guarded if gh pr merge 123; then :; fi",
    "coproc gh -R { pr merge 123",
    "function guarded if gh pr merge 123; then :; fi; guarded",
    "function guarded while gh pr merge 123; do :; done; guarded",
    "function guarded until gh pr merge 123; do :; done; guarded",
    "time function guarded if gh pr merge 123; then :; fi; guarded",
  ])("blocks %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// `env -S` (GNU split-string) — found by review on this PR, same bug class.
//
// The first cut of the shared resolver modelled `-S` as an ordinary value flag,
// so the wrapper scan ate the payload and the segment resolved to NOTHING —
// which this guard read as "not a merge" and allowed. A fix that closed
// eval/sh -c/xargs while opening a fresh `env -S` hole would have replaced one
// bypass with another while looking like a fix.
// ---------------------------------------------------------------------------
describe("block-direct-merge.cjs — env -S split-string", () => {
  it.each([
    "env -S 'gh pr merge 123'",
    'env -S "gh pr merge 123"',
    "env --split-string='gh pr merge 123'",
    "env -S'gh pr merge 123'",
    "env -i -S 'gh pr merge 123'",
    "env -iS 'gh pr merge 123'",
    "env -S 'gh api -X PUT repos/timothyfroehlich/PinPoint/pulls/1/merge'",
    "sudo env -S 'gh pr merge 1'",
    "xargs env -S 'gh pr merge 1'",
  ])("blocks %s", (command) => {
    const { status } = runHook(bashPayload(command));
    expect(status).toBe(2);
  });

  it("asks on a split-string merge-pr.sh payload (ask-gated, not denied)", () => {
    expectAsk(
      runHook(
        bashPayload("env -u FOO -S 'scripts/workflow/merge-pr.sh 1 --human'")
      )
    );
  });

  it("blocks a dynamic split-string payload that names a merge elsewhere", () => {
    const { status } = runHook(bashPayload("P='gh pr merge 1'; env -S \"$P\""));
    expect(status).toBe(2);
  });

  it.each([
    "env",
    "env | rg merge-pr.sh",
    "sudo -l",
    "timeout 30",
    "env -u NODE_OPTIONS pnpm run check",
  ])("does NOT block %s (wrapper consumed the segment)", (command) => {
    // These resolve to the wrapper itself. Reporting them unresolvable instead
    // would push this guard onto its raw-text fallback for ordinary commands,
    // and `env | rg merge-pr.sh` would block.
    const { status } = runHook(bashPayload(command));
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
    expectAllow(runHook(bashPayload(command)));
  });

  it("allows a heredoc whose BODY names the merge command", () => {
    expectAllow(
      runHook(
        bashPayload(
          [
            "cat > /tmp/handoff.md <<'EOF'",
            "gh pr merge 123 --squash",
            "scripts/workflow/merge-pr.sh 123 --human",
            "EOF",
          ].join("\n")
        )
      )
    );
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
