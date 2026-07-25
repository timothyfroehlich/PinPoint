// Unit tests for .claude/hooks/block-direct-merge.cjs — the PreToolUse hook
// that blocks agent-initiated PR merges (PP-wi85). Merging is human-only, with
// exactly one carve-out (PP-c0uy): a command that is EXACTLY
// `[bash] [path/]merge-pr.sh <number> --dependabot [--dry-run]` and nothing else.
// That is an anchored allowlist over the raw command, so the interesting tests
// below are the ones proving quote-hidden widening flags and smuggled second
// invocations stay blocked. The human channel is a `!`-prefixed command in Claude
// Code, which never generates a PreToolUse event and is outside this hook's reach.
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

  // --- Shell-wrapper class (pre-existing holes, closed by PP-c0uy) ---
  // The trigger used to require a recognized command-start position, which made it
  // an open-ended blacklist of invocation wrappers — every one of these reached a
  // full `--human` merge on origin/main. The fix stopped enumerating wrappers and
  // made the trigger "is merge-pr.sh named at all", letting the anchored allowlist
  // adjudicate. These are the shapes that motivated it; the point is the class,
  // not the list.
  it.each([
    [
      "for … do … done loop body",
      "for f in 1 2; do scripts/workflow/merge-pr.sh $f --human; done",
    ],
    [
      "then branch",
      "if true; then scripts/workflow/merge-pr.sh 123 --human; fi",
    ],
    [
      "else branch",
      "if false; then :; else scripts/workflow/merge-pr.sh 123 --human; fi",
    ],
    ["eval wrapper", "eval scripts/workflow/merge-pr.sh 123 --human"],
    ["exec wrapper", "exec scripts/workflow/merge-pr.sh 123 --human"],
    ["command wrapper", "command scripts/workflow/merge-pr.sh 123 --human"],
    ["time wrapper", "time scripts/workflow/merge-pr.sh 123 --human"],
    ["nohup wrapper", "nohup scripts/workflow/merge-pr.sh 123 --human"],
    ["brace group", "{ scripts/workflow/merge-pr.sh 123 --human; }"],
    [
      "case branch",
      "case x in x) scripts/workflow/merge-pr.sh 123 --human;; esac",
    ],
    ["xargs", "xargs -I{} scripts/workflow/merge-pr.sh {} --human <<< 123"],
  ])("blocks a merge-pr.sh invocation via %s", (_label, command) => {
    const { status } = runHook(bashPayload(command));
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

describe("block-direct-merge.cjs — Dependabot carve-out (PP-c0uy)", () => {
  it("ALLOWS `merge-pr.sh <PR> --dependabot`", () => {
    const { status } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123 --dependabot")
    );
    expect(status).toBe(0);
  });

  it("allows the carve-out with a path prefix and --dry-run", () => {
    const { status } = runHook(
      bashPayload("./scripts/workflow/merge-pr.sh 123 --dependabot --dry-run")
    );
    expect(status).toBe(0);
  });

  it("allows a bare `merge-pr.sh <PR> --dependabot` with no path prefix", () => {
    const { status } = runHook(bashPayload("merge-pr.sh 123 --dependabot"));
    expect(status).toBe(0);
  });

  it("allows the carve-out under a `bash` wrapper", () => {
    const { status } = runHook(
      bashPayload("bash scripts/workflow/merge-pr.sh 123 --dependabot")
    );
    expect(status).toBe(0);
  });

  it("blocks `--dependabot --force`", () => {
    const { status, stderr } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123 --dependabot --force")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("Merge is human-only.");
  });

  it("blocks `--dependabot --bypass-merge-requirements`", () => {
    const { status } = runHook(
      bashPayload(
        "scripts/workflow/merge-pr.sh 123 --dependabot --bypass-merge-requirements"
      )
    );
    expect(status).toBe(2);
  });

  it("blocks `--dependabot --human`", () => {
    const { status, stderr } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123 --dependabot --human")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("Merge is human-only.");
  });

  it("blocks two merge-pr.sh invocations even when the first carries --dependabot", () => {
    const { status } = runHook(
      bashPayload(
        "scripts/workflow/merge-pr.sh 123 --dependabot && scripts/workflow/merge-pr.sh 456 --dependabot"
      )
    );
    expect(status).toBe(2);
  });

  it("blocks a quoted `--dependabot` (fail closed)", () => {
    const { status } = runHook(
      bashPayload('scripts/workflow/merge-pr.sh 123 "--dependabot"')
    );
    expect(status).toBe(2);
  });

  // --- Regression: quote-hidden widening flags (found in review of PP-c0uy) ---
  // The first cut scanned the QUOTE-STRIPPED string for --human/--force/etc. and
  // blocked if found. Quoting hides a flag from that scan while the shell still
  // passes it, so each of these executed a full `--human` merge of an arbitrary PR
  // while the hook said yes. The fix is an anchored allowlist over the RAW command.
  it("blocks a quote-hidden --human with a trailing `# --dependabot` comment", () => {
    const { status } = runHook(
      bashPayload('scripts/workflow/merge-pr.sh 123 "--human" # --dependabot')
    );
    expect(status).toBe(2);
  });

  it("blocks a single-quote-hidden --human with a trailing comment", () => {
    const { status } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123 '--human' # --dependabot")
    );
    expect(status).toBe(2);
  });

  it('blocks an intra-word quote-split --human (--hum""an)', () => {
    const { status } = runHook(
      bashPayload('scripts/workflow/merge-pr.sh 123 --hum""an # --dependabot')
    );
    expect(status).toBe(2);
  });

  it("blocks a quote-split --bypass-merge-requirements alongside --dependabot", () => {
    const { status } = runHook(
      bashPayload(
        "scripts/workflow/merge-pr.sh 123 --dependabot --bypass-merge-req''uirements"
      )
    );
    expect(status).toBe(2);
  });

  it("blocks an eval'd second invocation hidden behind an allowed first one", () => {
    const { status } = runHook(
      bashPayload(
        'scripts/workflow/merge-pr.sh 123 --dependabot; eval "scripts/workflow/merge-pr.sh 456 --human"'
      )
    );
    expect(status).toBe(2);
  });

  // --- Allowlist strictness: anything but the exact shape is refused ---
  it("blocks the carve-out shape with a trailing pipe", () => {
    const { status } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123 --dependabot | tee out.txt")
    );
    expect(status).toBe(2);
  });

  it("blocks the carve-out shape with a redirect", () => {
    const { status } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123 --dependabot > out.txt")
    );
    expect(status).toBe(2);
  });

  it("blocks an env-var prefix on the carve-out shape", () => {
    const { status } = runHook(
      bashPayload("FOO=bar scripts/workflow/merge-pr.sh 123 --dependabot")
    );
    expect(status).toBe(2);
  });

  it("blocks flags in the wrong order (--dependabot before the PR number)", () => {
    const { status } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh --dependabot 123")
    );
    expect(status).toBe(2);
  });

  it("blocks a non-numeric PR argument", () => {
    const { status } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh abc --dependabot")
    );
    expect(status).toBe(2);
  });

  it("blocks an unrecognized extra flag alongside --dependabot", () => {
    const { status } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123 --dependabot --admin")
    );
    expect(status).toBe(2);
  });

  it("still blocks plain `merge-pr.sh <PR>` with no --dependabot", () => {
    const { status, stderr } = runHook(
      bashPayload("scripts/workflow/merge-pr.sh 123")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("Merge is human-only.");
  });

  it("still blocks `gh pr merge` regardless of a --dependabot mention", () => {
    const { status, stderr } = runHook(
      bashPayload("gh pr merge 123 --squash --dependabot")
    );
    expect(status).toBe(2);
    expect(stderr).toContain("Direct merge blocked: gh pr merge");
  });

  it("still blocks the MCP merge regardless of the carve-out", () => {
    const { status } = runHook({
      tool_name: "mcp__github__merge_pull_request",
      tool_input: { owner: "o", repo: "r", pullNumber: 123 },
    });
    expect(status).toBe(2);
  });

  it("mentions the carve-out shape in the merge-pr.sh refusal message", () => {
    const { stderr } = runHook(bashPayload("scripts/workflow/merge-pr.sh 123"));
    expect(stderr).toContain("merge-pr.sh <PR> --dependabot");
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
