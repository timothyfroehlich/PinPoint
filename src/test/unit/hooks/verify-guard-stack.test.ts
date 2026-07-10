// Unit tests for .claude/hooks/verify-guard-stack.cjs — the SessionStart
// guard-stack integrity canary.
//
// Two layers:
//   1. Fast path — the pure `evaluateGuardStack(settings)` evaluator is
//      exercised directly with in-memory fixture objects (no fs / exit / IO).
//   2. Fail-open contract — a couple of subprocess cases spawn `node` on the
//      hook with VERIFY_GUARD_SETTINGS pointed at a temp fixture, asserting the
//      warn-only guarantee (always exit 0, one-line skip note, no stack trace).

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Resolve the hook relative to the repo root (process.cwd() in vitest).
const require = createRequire(import.meta.url);
const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/verify-guard-stack.cjs"
);
const { evaluateGuardStack } = require(hookPath) as {
  evaluateGuardStack: (settings: unknown) => string[];
};

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------
const ALL_EXPECTED_HOOKS = [
  "block-dangerous-commands.cjs",
  "normalize-workspace-paths.cjs",
  "inject-beads-actor.cjs",
  "block-bad-shell-patterns.cjs",
  "block-heavy-under-pressure.cjs",
  "block-direct-merge.cjs",
  "block-main-worktree-branch-switch.cjs",
];

/** Build a settings object wiring the given hook basenames under PreToolUse. */
function settingsWithHooks(
  hookBasenames: string[],
  perms: { deny?: unknown; ask?: unknown } = {
    deny: ["Bash(x)"],
    ask: ["Bash(y)"],
  }
): unknown {
  return {
    permissions: perms,
    hooks: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: hookBasenames.map((b) => ({
            type: "command",
            command: `node .claude/hooks/${b}`,
            timeout: 5000,
          })),
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Fast path: pure evaluateGuardStack
// ---------------------------------------------------------------------------
describe("evaluateGuardStack — healthy", () => {
  it("reports no problems when all 7 hooks + non-empty permissions present", () => {
    const settings = settingsWithHooks(ALL_EXPECTED_HOOKS);
    expect(evaluateGuardStack(settings)).toEqual([]);
  });

  it("is healthy regardless of how hooks are distributed across matchers", () => {
    // Split the expected hooks across two PreToolUse matcher entries.
    const settings = {
      permissions: { deny: ["Bash(x)"], ask: ["Bash(y)"] },
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: ALL_EXPECTED_HOOKS.slice(0, 4).map((b) => ({
              type: "command",
              command: `node .claude/hooks/${b}`,
            })),
          },
          {
            matcher: "Bash|mcp__github__merge_pull_request",
            hooks: ALL_EXPECTED_HOOKS.slice(4).map((b) => ({
              type: "command",
              command: `node .claude/hooks/${b}`,
            })),
          },
        ],
      },
    };
    expect(evaluateGuardStack(settings)).toEqual([]);
  });
});

describe("evaluateGuardStack — missing hooks", () => {
  it("reports exactly the one missing hook basename", () => {
    const remaining = ALL_EXPECTED_HOOKS.filter(
      (b) => b !== "block-direct-merge.cjs"
    );
    const problems = evaluateGuardStack(settingsWithHooks(remaining));
    expect(problems).toEqual([
      "missing PreToolUse hooks: block-direct-merge.cjs",
    ]);
  });

  it("lists multiple missing hooks in one problem string", () => {
    const remaining = ALL_EXPECTED_HOOKS.filter(
      (b) =>
        b !== "block-dangerous-commands.cjs" &&
        b !== "block-main-worktree-branch-switch.cjs"
    );
    const problems = evaluateGuardStack(settingsWithHooks(remaining));
    expect(problems).toEqual([
      "missing PreToolUse hooks: block-dangerous-commands.cjs, block-main-worktree-branch-switch.cjs",
    ]);
  });

  it("reports all hooks missing when PreToolUse is absent entirely", () => {
    const problems = evaluateGuardStack({
      permissions: { deny: ["Bash(x)"], ask: ["Bash(y)"] },
      hooks: {},
    });
    expect(problems).toEqual([
      `missing PreToolUse hooks: ${ALL_EXPECTED_HOOKS.join(", ")}`,
    ]);
  });
});

describe("evaluateGuardStack — permissions", () => {
  it("reports permissions.deny empty/absent when deny is an empty array", () => {
    const problems = evaluateGuardStack(
      settingsWithHooks(ALL_EXPECTED_HOOKS, { deny: [], ask: ["Bash(y)"] })
    );
    expect(problems).toEqual(["permissions.deny empty/absent"]);
  });

  it("reports permissions.ask empty/absent when ask is missing", () => {
    const problems = evaluateGuardStack(
      settingsWithHooks(ALL_EXPECTED_HOOKS, { deny: ["Bash(x)"] })
    );
    expect(problems).toEqual(["permissions.ask empty/absent"]);
  });

  it("reports both when the whole permissions block is absent", () => {
    const problems = evaluateGuardStack({
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: ALL_EXPECTED_HOOKS.map((b) => ({
              type: "command",
              command: `node .claude/hooks/${b}`,
            })),
          },
        ],
      },
    });
    expect(problems).toEqual([
      "permissions.deny empty/absent",
      "permissions.ask empty/absent",
    ]);
  });
});

describe("evaluateGuardStack — combinations", () => {
  it("reports a missing hook AND emptied permissions together (the 2026-07-05 mode)", () => {
    const remaining = ALL_EXPECTED_HOOKS.filter(
      (b) => b !== "block-direct-merge.cjs"
    );
    const problems = evaluateGuardStack(
      settingsWithHooks(remaining, { deny: [], ask: [] })
    );
    expect(problems).toEqual([
      "missing PreToolUse hooks: block-direct-merge.cjs",
      "permissions.deny empty/absent",
      "permissions.ask empty/absent",
    ]);
  });

  it("treats an empty object as fully degraded", () => {
    const problems = evaluateGuardStack({});
    expect(problems).toEqual([
      `missing PreToolUse hooks: ${ALL_EXPECTED_HOOKS.join(", ")}`,
      "permissions.deny empty/absent",
      "permissions.ask empty/absent",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Fail-open contract: subprocess execution of the hook (warn-only guarantee)
// ---------------------------------------------------------------------------
const tmpFiles: string[] = [];

function writeTmp(name: string, contents: string): string {
  const p = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "verify-guard-stack-")),
    name
  );
  fs.writeFileSync(p, contents);
  tmpFiles.push(p);
  return p;
}

/** Run the hook as a subprocess; return { status, stdout, stderr }. */
function runHook(settingsFile: string | undefined): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const env = { ...process.env };
  if (settingsFile === undefined) {
    delete env.VERIFY_GUARD_SETTINGS;
  } else {
    env.VERIFY_GUARD_SETTINGS = settingsFile;
  }
  // spawnSync captures both stdout and stderr regardless of exit code, so the
  // warn-only (exit 0) path can still assert on stderr content.
  const result = spawnSync("node", [hookPath], {
    env,
    input: "",
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

afterAll(() => {
  for (const f of tmpFiles) {
    try {
      fs.rmSync(path.dirname(f), { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

describe("verify-guard-stack.cjs subprocess — fail-open contract", () => {
  it("malformed JSON → exit 0, single-line skip note, no stack trace", () => {
    const file = writeTmp("settings.json", "{");
    const { status, stdout, stderr } = runHook(file);
    expect(status).toBe(0);
    expect(stdout).toBe("");
    expect(stderr.trim()).toBe(
      "verify-guard-stack: skipped (settings.json is not valid JSON)"
    );
    // One line only, and no Node stack-trace markers.
    expect(stderr.trim().split("\n")).toHaveLength(1);
    expect(stderr).not.toContain("at ");
  });

  it("missing settings file → exit 0, single-line skip note", () => {
    const missing = path.join(
      os.tmpdir(),
      "verify-guard-stack-does-not-exist.json"
    );
    const { status, stdout, stderr } = runHook(missing);
    expect(status).toBe(0);
    expect(stdout).toBe("");
    expect(stderr.trim()).toMatch(
      /^verify-guard-stack: skipped \(cannot read settings\.json: ENOENT\)$/
    );
    expect(stderr.trim().split("\n")).toHaveLength(1);
  });

  it("healthy settings → exit 0, no stdout/stderr noise", () => {
    const file = writeTmp(
      "settings.json",
      JSON.stringify(settingsWithHooks(ALL_EXPECTED_HOOKS), null, 2)
    );
    const { status, stdout, stderr } = runHook(file);
    expect(status).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toBe("");
  });

  it("degraded settings → exit 0 (warn-only) with the GUARD STACK DEGRADED warning", () => {
    const remaining = ALL_EXPECTED_HOOKS.filter(
      (b) => b !== "block-direct-merge.cjs"
    );
    const file = writeTmp(
      "settings.json",
      JSON.stringify(
        settingsWithHooks(remaining, { deny: [], ask: [] }),
        null,
        2
      )
    );
    const { status, stdout, stderr } = runHook(file);
    expect(status).toBe(0); // never blocks
    expect(stdout).toBe("");
    expect(stderr).toContain("GUARD STACK DEGRADED");
    expect(stderr).toContain("block-direct-merge.cjs");
    expect(stderr).toContain("permissions.deny empty/absent");
  });
});
