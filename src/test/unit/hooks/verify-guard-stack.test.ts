// Unit tests for .claude/hooks/verify-guard-stack.cjs — the SessionStart
// guard-stack integrity canary.
//
// Three layers:
//   1. Fast path — `evaluateGuardStack(settings)` is exercised directly with
//      in-memory fixture objects. Both directions: expected-hook-not-registered
//      (forward) and registered-script-not-on-disk (reverse). The reverse check
//      takes an injectable `exists` predicate so it needs no real files.
//   2. The repo's own .claude/settings.json — asserted healthy in both
//      directions, so `pnpm run check` goes red on a dead registration.
//   3. Behaviour probes — `evaluateGuardBehavior()` calls each guard's exported
//      pure classifier with a known-bad and a known-good command. Registration
//      is a weak proxy for a working guard: the merge guard was fully wired and
//      present on disk while allowing `eval "gh pr merge 123"` (PP-6t3c).
//   4. Fail-open contract — a few subprocess cases spawn `node` on the hook
//      with VERIFY_GUARD_SETTINGS pointed at a temp fixture, asserting the
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
interface BehaviorProbe {
  hook: string;
  export: string;
  mustDeny?: string[];
  mustAsk?: string[];
  mustAllow?: string[];
}

const {
  evaluateGuardStack,
  evaluateGuardBehavior,
  extractScriptPaths,
  BEHAVIOR_PROBES,
} = require(hookPath) as {
  evaluateGuardStack: (
    settings: unknown,
    options?: { exists?: (relPath: string) => boolean }
  ) => string[];
  evaluateGuardBehavior: (options?: {
    load?: (basename: string) => unknown;
  }) => string[];
  extractScriptPaths: (command: string) => string[];
  BEHAVIOR_PROBES: BehaviorProbe[];
};

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------
const ALL_EXPECTED_HOOKS = [
  "inject-beads-actor.cjs",
  "block-direct-merge.cjs",
  "block-main-worktree-branch-switch.cjs",
  "block-worktree-dispatch-from-linked.cjs",
  "block-gh-pr-checkout.cjs",
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
  it("reports no problems when all expected hooks + non-empty permissions present", () => {
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
            hooks: ALL_EXPECTED_HOOKS.slice(0, 3).map((b) => ({
              type: "command",
              command: `node .claude/hooks/${b}`,
            })),
          },
          {
            matcher: "Bash|mcp__github__merge_pull_request",
            hooks: ALL_EXPECTED_HOOKS.slice(3).map((b) => ({
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
        b !== "inject-beads-actor.cjs" &&
        b !== "block-main-worktree-branch-switch.cjs"
    );
    const problems = evaluateGuardStack(settingsWithHooks(remaining));
    expect(problems).toEqual([
      "missing PreToolUse hooks: inject-beads-actor.cjs, block-main-worktree-branch-switch.cjs",
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
// Reverse direction: a registration whose script no longer exists on disk
// ---------------------------------------------------------------------------

/** Build settings wiring arbitrary command strings under a given hook event. */
function settingsWithCommands(
  event: "PostToolUse" | "SessionStart" | "UserPromptSubmit",
  commands: string[]
): unknown {
  return {
    permissions: { deny: ["Bash(x)"], ask: ["Bash(y)"] },
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
      [event]: [
        { hooks: commands.map((command) => ({ type: "command", command })) },
      ],
    },
  };
}

describe("extractScriptPaths", () => {
  it("pulls the script path out of the command shapes settings.json uses", () => {
    expect(
      extractScriptPaths("node .claude/hooks/block-direct-merge.cjs")
    ).toEqual([".claude/hooks/block-direct-merge.cjs"]);
    expect(
      extractScriptPaths(
        'bash "${CLAUDE_PROJECT_DIR:-.}"/scripts/hooks/prototype-mode-poll.sh'
      )
    ).toEqual(["scripts/hooks/prototype-mode-poll.sh"]);
    expect(
      extractScriptPaths(
        'HUDDLE_THROTTLE_SECONDS=180 bash "$CLAUDE_PROJECT_DIR"/scripts/hooks/prototype-mode-poll.sh'
      )
    ).toEqual(["scripts/hooks/prototype-mode-poll.sh"]);
  });

  it("skips commands that are not repo-relative script paths", () => {
    // Inline programs, bare binaries on $PATH, flags, absolute paths, and
    // unresolved shell expansion all yield nothing rather than a false alarm.
    for (const command of [
      `node -e "console.log(1)"`,
      `bash -c 'echo hi'`,
      "bd sync --quiet",
      "echo 'scripts/hooks/nope'",
      "bash /usr/local/bin/something.sh",
      "bash ~/dotfiles/thing.sh",
      'bash "$SOME_OTHER_DIR"/thing.sh',
      "bash ../outside-the-repo.sh",
    ]) {
      expect(extractScriptPaths(command)).toEqual([]);
    }
  });
});

describe("evaluateGuardStack — registered-but-missing-from-disk", () => {
  it("reports a PreToolUse registration whose script was deleted", () => {
    // Every expected hook is wired, so the FORWARD check is clean — this is
    // exactly the blind spot: the registration exists, the file does not.
    const settings = settingsWithHooks([
      ...ALL_EXPECTED_HOOKS,
      "block-drizzle-push.cjs",
    ]);
    const problems = evaluateGuardStack(settings, {
      exists: (relPath) => relPath !== ".claude/hooks/block-drizzle-push.cjs",
    });
    expect(problems).toEqual([
      "registered hooks missing from disk: .claude/hooks/block-drizzle-push.cjs",
    ]);
  });

  it("checks registrations under non-PreToolUse events too", () => {
    const settings = settingsWithCommands("SessionStart", [
      'bash "${CLAUDE_PROJECT_DIR:-.}"/scripts/hooks/deleted-session-hook.sh',
    ]);
    const problems = evaluateGuardStack(settings, {
      exists: (relPath) => !relPath.includes("deleted-session-hook"),
    });
    expect(problems).toEqual([
      "registered hooks missing from disk: scripts/hooks/deleted-session-hook.sh",
    ]);
  });

  it("lists each dead registration once, in wiring order", () => {
    const settings = settingsWithCommands("PostToolUse", [
      "node .claude/hooks/gone-a.cjs",
      'bash "${CLAUDE_PROJECT_DIR:-.}"/scripts/hooks/gone-b.sh',
      "node .claude/hooks/gone-a.cjs",
    ]);
    const problems = evaluateGuardStack(settings, {
      exists: (relPath) => !relPath.includes("gone-"),
    });
    expect(problems).toEqual([
      "registered hooks missing from disk: .claude/hooks/gone-a.cjs, scripts/hooks/gone-b.sh",
    ]);
  });

  it("stays silent when every registration resolves to a real file", () => {
    // No `exists` override — this hits the real filesystem against the real
    // repo, and every basename below is a file that exists.
    const settings = settingsWithCommands("SessionStart", [
      'bash "${CLAUDE_PROJECT_DIR:-.}"/scripts/hooks/prototype-mode-poll.sh',
      "node .claude/hooks/verify-guard-stack.cjs",
    ]);
    expect(evaluateGuardStack(settings)).toEqual([]);
  });

  it("does not flag non-path commands (inline shell, $PATH binaries)", () => {
    const settings = settingsWithCommands("PostToolUse", [
      `node -e "process.exit(0)"`,
      "bd sync --quiet",
      `bash -c 'echo scripts/hooks/not-a-real-file.sh'`,
    ]);
    // Only the real PreToolUse guard files "exist"; anything pulled out of the
    // three commands above would be reported.
    expect(
      evaluateGuardStack(settings, {
        exists: (relPath) => relPath.startsWith(".claude/hooks/"),
      })
    ).toEqual([]);
  });

  it("reports both directions at once", () => {
    const remaining = ALL_EXPECTED_HOOKS.filter(
      (b) => b !== "block-direct-merge.cjs"
    );
    const settings = settingsWithHooks([
      ...remaining,
      "block-drizzle-push.cjs",
    ]);
    const problems = evaluateGuardStack(settings, {
      exists: (relPath) => relPath !== ".claude/hooks/block-drizzle-push.cjs",
    });
    expect(problems).toEqual([
      "missing PreToolUse hooks: block-direct-merge.cjs",
      "registered hooks missing from disk: .claude/hooks/block-drizzle-push.cjs",
    ]);
  });
});

// ---------------------------------------------------------------------------
// The real .claude/settings.json — this is the assertion that makes CI red
// when a hook file is deleted without dropping its registration (or vice
// versa). Both canary directions, checked against the repo as it actually is.
// ---------------------------------------------------------------------------
describe("the repo's own .claude/settings.json", () => {
  it("has a healthy guard stack in both directions", () => {
    const settings: unknown = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), ".claude/settings.json"),
        "utf8"
      )
    );
    expect(evaluateGuardStack(settings)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Behaviour probes (PP-6t3c): the canary used to answer only "is the guard
// registered?". A registered, on-disk, silently-permissive guard reads as
// healthy under that question — which is exactly what the merge guard was.
// ---------------------------------------------------------------------------
describe("evaluateGuardBehavior — the real guards", () => {
  it("reports no problems: every guard still blocks its known-bad commands", () => {
    expect(evaluateGuardBehavior()).toEqual([]);
  });

  it("covers the merge guard's wrapper bypasses (deny) and the script (ask)", () => {
    const mergeProbe = BEHAVIOR_PROBES.find(
      (p) => p.hook === "block-direct-merge.cjs"
    );
    expect(mergeProbe).toBeDefined();
    // Raw channels stay a hard deny...
    expect(mergeProbe?.mustDeny).toContain('eval "gh pr merge 123 --squash"');
    // ...while the gate-enforced script is ask-gated, not denied.
    expect(mergeProbe?.mustAsk).toContain(
      "scripts/workflow/merge-pr.sh 123 --human"
    );
  });
});

describe("evaluateGuardBehavior — degradation is reported, never thrown", () => {
  it("reports a guard that stopped acting (allows a known-bad command)", () => {
    const problems = evaluateGuardBehavior({
      load: () => ({
        classifyMerge: () => ({ block: false }),
        classifyCommand: () => ({ block: false }),
      }),
    });
    // block:false → outcome "allow", so the deny/ask rows fail with "got allow".
    expect(problems.join("\n")).toContain("block-direct-merge.cjs expected");
    expect(problems.join("\n")).toContain("got allow");
    expect(problems.join("\n")).toContain(
      'eval \\"gh pr merge 123 --squash\\"'
    );
  });

  it("reports the merge script silently reverting to a hard deny", () => {
    // The reversal's own regression: merge-pr.sh must ASK, not deny. A guard
    // that classifies it as a plain block (kind !== "merge-script") over-blocks,
    // and the canary must catch that direction too.
    const problems = evaluateGuardBehavior({
      load: () => ({
        classifyMerge: (toolName: string, command: string) =>
          String(command).includes("merge-pr.sh")
            ? { block: true, kind: "merge" } // wrong: should be "merge-script"
            : { block: false },
        classifyCommand: () => ({ block: false }),
      }),
    });
    expect(problems.join("\n")).toContain("expected ask");
    expect(problems.join("\n")).toContain("got deny");
  });

  it("reports a guard that started blocking everything", () => {
    const problems = evaluateGuardBehavior({
      load: () => ({
        classifyMerge: () => ({ block: true }),
        classifyCommand: () => ({ block: true }),
      }),
    });
    // Everything reads as "deny": the allow rows now fail with "got deny".
    expect(problems.join("\n")).toContain("got deny");
    expect(problems).toHaveLength(BEHAVIOR_PROBES.length);
  });

  it("reports a guard that lost its exported classifier", () => {
    const problems = evaluateGuardBehavior({ load: () => ({}) });
    expect(problems.join("\n")).toContain("no longer exports");
  });

  it("reports — does not throw — when a guard cannot be loaded at all", () => {
    const problems = evaluateGuardBehavior({
      load: () => {
        throw Object.assign(new Error("boom"), { code: "MODULE_NOT_FOUND" });
      },
    });
    expect(problems).toHaveLength(BEHAVIOR_PROBES.length);
    expect(problems.join("\n")).toContain("could not be loaded");
  });

  it("reports — does not throw — when a classifier itself throws", () => {
    const problems = evaluateGuardBehavior({
      load: () => ({
        classifyMerge: () => {
          throw new Error("boom");
        },
        classifyCommand: () => {
          throw new Error("boom");
        },
      }),
    });
    expect(problems).toHaveLength(BEHAVIOR_PROBES.length);
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

  it("dead registration → exit 0 (warn-only) naming the missing script", () => {
    // Forward check clean, file gone: the failure mode this canary used to miss.
    const file = writeTmp(
      "settings.json",
      JSON.stringify(
        settingsWithHooks([...ALL_EXPECTED_HOOKS, "deleted-guard-fixture.cjs"]),
        null,
        2
      )
    );
    const { status, stdout, stderr } = runHook(file);
    expect(status).toBe(0); // never blocks
    expect(stdout).toBe("");
    expect(stderr).toContain("GUARD STACK DEGRADED");
    expect(stderr).toContain(
      "registered hooks missing from disk: .claude/hooks/deleted-guard-fixture.cjs"
    );
    expect(stderr).not.toContain("missing PreToolUse hooks");
  });
});
