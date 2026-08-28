// Unit tests for the `classifyCommand` classifier exported from
// .claude/hooks/block-gh-pr-checkout.cjs (PP-p53z).
//
// The classifier is pure (no git/fs I/O) so these tests run without any
// external dependencies. It BLOCKS `gh pr checkout` in every worktree — that
// command creates a throwaway local branch and switches the checkout onto it,
// stranding a lead agent's later commits — while allowing the read-only PR
// inspection commands (`gh pr diff`, `gh pr view`) that review agents should
// use instead.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Resolve the hook relative to the repo root (process.cwd() in vitest).
const require = createRequire(import.meta.url);
const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-gh-pr-checkout.cjs"
);
const { classifyCommand } = require(hookPath) as {
  classifyCommand: (cmd: string) => { block: boolean; detail: string };
};

/** Drive the real stdin entrypoint the way Claude Code invokes it. */
function runHook(payload: unknown): { status: number; stderr: string } {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stderr: result.stderr ?? "" };
}

function bashPayload(command: string) {
  return { tool_name: "Bash", tool_input: { command } };
}

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
// Direct `gh pr checkout` invocations — must BLOCK
// ---------------------------------------------------------------------------
describe("direct gh pr checkout → BLOCK", () => {
  it("blocks gh pr checkout <number>", () => {
    expectBlock("gh pr checkout 1727");
  });

  it("blocks gh pr checkout <branch>", () => {
    expectBlock("gh pr checkout feat/some-branch");
  });

  it("blocks gh pr checkout with trailing flags", () => {
    expectBlock("gh pr checkout 1727 --detach");
  });

  it("blocks the built-in `co` alias (gh pr co)", () => {
    // `co` is shipped as an ALIAS for `checkout`, so `gh pr co 1` does the
    // identical branch-create-and-switch — the classifier and the entrypoint
    // prefilter must both recognize it (PP-p53z Codex review).
    expectBlock("gh pr co 1727");
  });

  it("blocks the `co` alias behind an -R flag", () => {
    expectBlock("gh -R timothyfroehlich/PinPoint pr co 1727");
  });

  it("blocks gh pr checkout behind a value-consuming -R flag", () => {
    expectBlock("gh -R timothyfroehlich/PinPoint pr checkout 1727");
  });

  it("blocks gh pr checkout behind a --repo=... flag", () => {
    expectBlock("gh --repo=timothyfroehlich/PinPoint pr checkout 1727");
  });

  it("blocks gh pr checkout behind a value-consuming --hostname flag", () => {
    // Parity with block-direct-merge.cjs's GH_VALUE_FLAGS — a divergent omission
    // here was a real bypass (the flag's value shifted the positionals).
    expectBlock("gh --hostname ghe.example.com pr checkout 1727");
  });

  it("reports a stable detail string", () => {
    expect(classifyCommand("gh pr checkout 1727").detail).toBe(
      "gh pr checkout"
    );
  });
});

// ---------------------------------------------------------------------------
// Wrapper / quoting shapes that used to slip past bespoke regexes — must BLOCK
// ---------------------------------------------------------------------------
describe("wrapped / quoted gh pr checkout → BLOCK", () => {
  it('blocks eval "gh pr checkout N"', () => {
    expectBlock('eval "gh pr checkout 1727"');
  });

  it("blocks env gh pr checkout N", () => {
    expectBlock("env gh pr checkout 1727");
  });

  it("blocks sh -c '...'", () => {
    expectBlock("sh -c 'gh pr checkout 1727'");
  });

  it("blocks xargs -I{} gh pr checkout {}", () => {
    expectBlock("xargs -I{} gh pr checkout {} < prs.txt");
  });

  it("blocks a gh pr checkout in a later segment of a chain", () => {
    expectBlock("git fetch origin && gh pr checkout 1727");
  });
});

// ---------------------------------------------------------------------------
// Read-only PR inspection and unrelated gh usage — must ALLOW
// ---------------------------------------------------------------------------
describe("read-only and unrelated gh usage → ALLOW", () => {
  it("allows gh pr diff", () => {
    expectAllow("gh pr diff 1727");
  });

  it("allows gh pr view", () => {
    expectAllow("gh pr view 1727");
  });

  it("allows gh pr list", () => {
    expectAllow("gh pr list");
  });

  it("allows gh pr checks", () => {
    expectAllow("gh pr checks 1727");
  });

  it("allows gh pr comment (not the `co`/`checkout` alias)", () => {
    expectAllow("gh pr comment 1727 --body hi");
  });

  it("allows gh issue commands", () => {
    expectAllow("gh issue view 42");
  });

  it("allows a bare gh", () => {
    expectAllow("gh");
  });
});

// ---------------------------------------------------------------------------
// False-positive guards: the string appears but no gh command runs — ALLOW
// ---------------------------------------------------------------------------
describe("string mentions that are not a gh invocation → ALLOW", () => {
  it("allows echo of the phrase", () => {
    expectAllow("echo gh pr checkout 1727");
  });

  it("allows a quoted phrase argument", () => {
    expectAllow('echo "never run gh pr checkout"');
  });

  it("allows grepping for the phrase", () => {
    expectAllow("rg 'gh pr checkout'");
  });

  it("allows an unrelated command containing the words out of order", () => {
    expectAllow("checkout_pr_via_gh --help");
  });

  it("allows an empty command", () => {
    expectAllow("");
  });
});

// ---------------------------------------------------------------------------
// The real stdin entrypoint — exit code is what actually gates the tool call.
// The classifier can be perfect while the entrypoint mis-wires the payload, so
// exercise it end-to-end the way the sibling guards do (spawnSync + JSON stdin).
// ---------------------------------------------------------------------------
describe("stdin entrypoint → exit code", () => {
  it("exits 2 and explains when a Bash gh pr checkout is seen", () => {
    const { status, stderr } = runHook(bashPayload("gh pr checkout 1727"));
    expect(status).toBe(2);
    expect(stderr).toContain("gh pr checkout");
  });

  it("exits 2 for the `co` alias", () => {
    expect(runHook(bashPayload("gh pr co 1727")).status).toBe(2);
  });

  it("exits 2 for the --hostname bypass shape", () => {
    const { status } = runHook(
      bashPayload("gh --hostname ghe.example.com pr checkout 1727")
    );
    expect(status).toBe(2);
  });

  it("exits 0 for a read-only gh pr diff", () => {
    expect(runHook(bashPayload("gh pr diff 1727")).status).toBe(0);
  });

  it("exits 0 for a mere mention of the phrase", () => {
    expect(runHook(bashPayload("echo gh pr checkout 1727")).status).toBe(0);
  });

  it("exits 0 for a non-Bash tool even with a matching command field", () => {
    const { status } = runHook({
      tool_name: "Read",
      tool_input: { command: "gh pr checkout 1727" },
    });
    expect(status).toBe(0);
  });

  it("exits 0 (fails open) on a malformed payload", () => {
    const result = spawnSync("node", [hookPath], {
      input: "not json",
      encoding: "utf8",
    });
    expect(result.status ?? 1).toBe(0);
  });
});
