#!/usr/bin/env node
/**
 * SessionStart hook: Guard-stack integrity canary (warn-only, fail-open).
 *
 * On 2026-07-05 a settings.json rewrite silently deleted PinPoint's entire
 * PreToolUse guard-hook stack + the permissions deny/ask block, and the
 * session ran GUARDLESS for ~1.5h before it was caught. Nothing detected it.
 *
 * This canary reads .claude/settings.json at session start and warns (to
 * stderr) if the guard stack has degraded in EITHER direction:
 *   - forward:  an expected PreToolUse guard hook is missing from the wired
 *               command strings (a rewrite dropped a guard);
 *   - reverse:  a wired command points at a script file that no longer exists
 *               on disk (a cleanup deleted the file but left the
 *               registration). A dead registration is silently no-guard: Node
 *               / bash just fails to load a missing file on every matching
 *               tool call.
 * ...or if permissions.deny / permissions.ask have been stripped.
 *
 * It ALSO probes behaviour, not just registration (PP-6t3c). Registration is a
 * weak proxy: on 2026-07-26 the merge guard was fully registered, fully present
 * on disk — and allowed `eval "gh pr merge 123"`. A guard that no longer acts on
 * a known-bad command is as degraded as a missing one, so each guard's exported
 * pure classifier is called here with a small DENY/ASK/ALLOW table. The merge
 * guard's expected OUTCOME is per channel: the raw channels (gh pr merge, gh api
 * PUT .../merge, MCP merge) must DENY, while merge-pr.sh must ASK — an approval
 * prompt, not a block (PP-wi85 reversed for the script only, per Tim 2026-08-19).
 * It is PURELY INFORMATIONAL:
 *   - It NEVER blocks anything and NEVER exits non-zero.
 *   - Healthy path prints NOTHING (no session noise).
 *   - Any error (missing/unreadable/malformed settings.json) fails open with
 *     at most a single one-line skip note to stderr.
 *
 * KNOWN LIMITATION: this hook is itself wired in settings.json, so a total
 * settings.json wipe removes the canary along with the guards — it cannot
 * detect its own deletion. It catches partial degradation (a rewrite that
 * drops some hooks / the permissions block) but not a full removal.
 *
 * Override: set VERIFY_GUARD_SETTINGS to point at an alternate settings.json
 * (used by tests to run against a scratch file); defaults to ../settings.json
 * relative to this hook file.
 */

const path = require("node:path");
const fs = require("node:fs");

// Keep in sync when adding/removing a PreToolUse guard hook.
const EXPECTED_GUARD_HOOKS = [
  "inject-beads-actor.cjs",
  "block-direct-merge.cjs",
  "block-main-worktree-branch-switch.cjs",
  "block-gh-pr-checkout.cjs",
];

// --- Registered-script extraction --------------------------------------------
// Hook `command` values are shell strings. For the reverse check we only need
// the repo-relative script path they invoke, e.g.
//   `node .claude/hooks/block-direct-merge.cjs`             → .claude/hooks/block-direct-merge.cjs
//   `bash "${CLAUDE_PROJECT_DIR:-.}"/scripts/hooks/x.sh`    → scripts/hooks/x.sh
//   `HUDDLE_THROTTLE_SECONDS=180 bash "$CLAUDE_PROJECT_DIR"/x.sh` → x.sh
//
// DELIBERATELY CONSERVATIVE: anything we cannot resolve with confidence — an
// absolute path, a bare binary on $PATH, an inline `node -e '…'` program, a
// token with unresolved shell expansion or metacharacters — is SKIPPED, not
// flagged. A missed exotic registration is far cheaper than a canary that
// cries wolf every session.
//
// Global Huddle registrations live in machine/user settings and dotfiles, not
// this project settings file. This project canary intentionally verifies only
// the project-owned guard stack below.

const SCRIPT_EXTENSIONS = new Set([".cjs", ".mjs", ".js", ".sh", ".py", ".ts"]);
// Any of these in a token means shell machinery we won't try to interpret.
const SHELL_METACHARS = /[(){}[\]|;&<>*?!`\\]/;
// Flags that hand the rest of the command to an inline program (`node -e '…'`,
// `bash -c '…'`). A path mentioned INSIDE such a program is a string, not a
// registration — bail on the whole command rather than flag it.
const INLINE_PROGRAM_FLAGS = new Set([
  "-c",
  "-e",
  "-p",
  "--eval",
  "--print",
  "--command",
]);

/**
 * Extract the repo-relative script path(s) a hook command invokes.
 * Returns [] when nothing resolvable is present.
 */
function extractScriptPaths(command) {
  const found = [];
  const rawTokens = String(command || "").split(/\s+/);
  if (rawTokens.some((t) => INLINE_PROGRAM_FLAGS.has(t.replace(/["']/g, "")))) {
    return found;
  }

  for (const rawToken of rawTokens) {
    if (!rawToken) continue;

    // Drop quoting, then substitute the one variable form our settings use.
    const token = rawToken
      .replace(/["']/g, "")
      .replace(/\$\{CLAUDE_PROJECT_DIR(?::-[^}]*)?\}/g, ".")
      .replace(/\$CLAUDE_PROJECT_DIR/g, ".");

    if (token.startsWith("-")) continue; // a flag, not a path
    if (!token.includes("/")) continue; // bare binary name / env assignment
    if (token.startsWith("/") || token.startsWith("~")) continue; // absolute
    if (token.includes("$") || SHELL_METACHARS.test(token)) continue; // unresolvable
    if (!SCRIPT_EXTENSIONS.has(path.posix.extname(token))) continue;

    const normalized = path.posix.normalize(token);
    if (normalized.startsWith("..")) continue; // escapes the repo root
    if (!found.includes(normalized)) found.push(normalized);
  }
  return found;
}

/**
 * Does a repo-relative script path exist on disk?
 *
 * Resolves against the candidate roots a hook itself would use
 * (CLAUDE_PROJECT_DIR → __dirname-relative → cwd) and counts the script as
 * present if ANY candidate root has it. Inside a worktree the hook runs from
 * the worktree's own .claude/hooks/, and CLAUDE_PROJECT_DIR may point at a
 * different checkout — accepting any root keeps that from reading as a dead
 * registration.
 */
function defaultScriptExists(relPath) {
  const roots = [
    process.env.CLAUDE_PROJECT_DIR,
    path.join(__dirname, "..", ".."),
    process.cwd(),
  ].filter(Boolean);
  return roots.some((root) => {
    try {
      return fs.existsSync(path.join(root, relPath));
    } catch {
      return false;
    }
  });
}

/** Every `command` string wired under one hook-event array. */
function collectCommands(eventEntries) {
  const commands = [];
  if (!Array.isArray(eventEntries)) return commands;
  for (const entry of eventEntries) {
    const inner = entry?.hooks;
    if (!Array.isArray(inner)) continue;
    for (const h of inner) {
      if (typeof h?.command === "string") {
        commands.push(h.command);
      }
    }
  }
  return commands;
}

// --- Evaluator (unit-testable; only IO is the on-disk existence probe) -------
// Given a parsed settings object, return the list of guard-stack problems as
// human-readable strings. Empty array === healthy. No printing, no exit.
//
// `options.exists` overrides the on-disk probe with a `(relPath) => boolean`
// predicate, so tests can exercise the reverse check without touching the fs.
//
// Problems reported:
//   - `missing PreToolUse hooks: <basename>, ...` when any EXPECTED_GUARD_HOOKS
//     basename is absent from every wired PreToolUse command string.
//   - `registered hooks missing from disk: <path>, ...` when a command wired
//     under ANY hook event points at a script file that does not exist.
//   - `permissions.deny empty/absent` / `permissions.ask empty/absent` when
//     either is not a non-empty array.
function evaluateGuardStack(settings, options = {}) {
  const problems = [];
  const exists =
    typeof options.exists === "function" ? options.exists : defaultScriptExists;

  // Forward: every expected guard hook must be wired under PreToolUse.
  const commands = collectCommands(settings?.hooks?.PreToolUse);

  const missingHooks = EXPECTED_GUARD_HOOKS.filter(
    (basename) => !commands.some((cmd) => cmd.includes(basename)),
  );
  if (missingHooks.length > 0) {
    problems.push(`missing PreToolUse hooks: ${missingHooks.join(", ")}`);
  }

  // Reverse: every registered script — under ANY event, not just PreToolUse —
  // must still exist on disk. A registration pointing at a deleted file is a
  // guard that silently isn't there.
  const hooksByEvent = settings?.hooks;
  const deadRegistrations = [];
  if (hooksByEvent && typeof hooksByEvent === "object") {
    for (const eventEntries of Object.values(hooksByEvent)) {
      for (const command of collectCommands(eventEntries)) {
        for (const scriptPath of extractScriptPaths(command)) {
          if (!exists(scriptPath) && !deadRegistrations.includes(scriptPath)) {
            deadRegistrations.push(scriptPath);
          }
        }
      }
    }
  }
  if (deadRegistrations.length > 0) {
    problems.push(
      `registered hooks missing from disk: ${deadRegistrations.join(", ")}`,
    );
  }

  // permissions.deny / permissions.ask must both be present, non-empty arrays.
  const perms = settings?.permissions;
  const denyOk = Array.isArray(perms?.deny) && perms.deny.length > 0;
  const askOk = Array.isArray(perms?.ask) && perms.ask.length > 0;
  if (!denyOk) problems.push("permissions.deny empty/absent");
  if (!askOk) problems.push("permissions.ask empty/absent");

  return problems;
}

// --- Behaviour probes ---------------------------------------------------------
// "Is the guard still wired?" is not the same question as "does the guard still
// act?". Each entry names a guard, the pure classifier it exports, an `outcome`
// mapper that reduces the classifier's return to one of "deny" | "ask" |
// "allow", and command tables for each expected outcome. Probes run IN-PROCESS
// against the exported classifier (no subprocess, no git, no fs) so this stays
// well inside the SessionStart hook's 5 s budget.
//
// The merge guard has TWO block outcomes that must not be confused: the raw
// channels DENY (hard block, exit 2) and merge-pr.sh ASKS (approval prompt,
// exit 0). Asserting "ask" for merge-pr.sh — not merely "some block" — is what
// catches a regression in EITHER direction: the script silently reverting to a
// hard deny (over-blocking), or silently ceasing to be recognized (guard off).
//
// Keep the ALLOW rows: a guard that starts blocking everything is also broken,
// and these are the exact prose shapes agents legitimately type.
//
// MERGE_MCP_PROBE is a sentinel: when it is the probe input, the merge outcome
// mapper feeds it as the TOOL NAME (not a Bash command) so the MCP merge channel
// is exercised through the same table.
const MERGE_MCP_PROBE = "mcp__github__merge_pull_request";
const MERGE_MCP_OTHER_REPOSITORY_PROBE =
  "mcp__github__merge_pull_request:other-repository";

const BEHAVIOR_PROBES = [
  {
    hook: "block-direct-merge.cjs",
    export: "classifyMerge",
    // classifyMerge(toolName, command) → { block, kind }. Reduce to an outcome:
    // block:false → allow; kind "merge-script" → ask; any other block → deny.
    outcome: (fn, input) => {
      let result;
      if (input === MERGE_MCP_PROBE) {
        result = fn(input, {
          owner: "timothyfroehlich",
          repo: "PinPoint",
          pull_number: 123,
        });
      } else if (input === MERGE_MCP_OTHER_REPOSITORY_PROBE) {
        result = fn(MERGE_MCP_PROBE, {
          owner: "timothyfroehlich",
          repo: "dotfiles",
          pull_number: 4,
        });
      } else {
        result = fn("Bash", input);
      }
      const { block, kind } = result;
      if (!block) return "allow";
      return kind === "merge-script" ? "ask" : "deny";
    },
    mustDeny: [
      "gh pr merge 123 --squash",
      "gh pr merge 123 --repo timothyfroehlich/PinPoint --squash",
      'gh pr merge 123 --repo "$TARGET_REPOSITORY" --squash',
      "GH_REPO=timothyfroehlich/dotfiles gh pr merge 123 --squash",
      'eval "gh pr merge 123 --squash"',
      "if gh pr merge 123; then echo blocked; fi",
      "! gh pr merge 123",
      "{ gh pr merge 123; }",
      "while gh pr merge 123; do echo blocked; done",
      "function guarded { gh pr merge 123; }; guarded",
      "coproc gh pr merge 123",
      "time if gh pr merge 123; then echo blocked; fi",
      "coproc guarded if gh pr merge 123; then :; fi",
      "coproc gh -R { pr merge 123",
      "function guarded if gh pr merge 123; then :; fi; guarded",
      "xargs -I{} gh pr merge {} < prs.txt",
      "env -S 'gh pr merge 123'",
      "gh api -X PUT repos/timothyfroehlich/PinPoint/pulls/123/merge",
      "gh api -XPUT repos/timothyfroehlich/PinPoint/pulls/123/merge",
      MERGE_MCP_PROBE,
    ],
    mustAsk: [
      "scripts/workflow/merge-pr.sh 123 --human",
      "bash scripts/workflow/merge-pr.sh 123",
      'sh -c "scripts/workflow/merge-pr.sh 123 --human"',
    ],
    mustAllow: [
      "gh pr view 123",
      "gh pr merge 4 --repo timothyfroehlich/dotfiles --squash",
      "gh api -X PUT repos/timothyfroehlich/dotfiles/pulls/4/merge",
      MERGE_MCP_OTHER_REPOSITORY_PROBE,
      'echo "run merge-pr.sh when ready"',
      "env | rg merge-pr.sh",
    ],
  },
  {
    hook: "block-main-worktree-branch-switch.cjs",
    export: "classifyCommand",
    outcome: (fn, command) => (fn(command).block ? "deny" : "allow"),
    mustDeny: [
      "git checkout feature/x",
      'eval "git switch feature/x"',
      "if git checkout feature/x; then echo blocked; fi",
      "! git checkout feature/x",
      "{ git checkout feature/x; }",
      "while git checkout feature/x; do echo blocked; done",
      "function guarded { git checkout feature/x; }; guarded",
      "coproc git checkout feature/x",
      "time if git checkout feature/x; then echo blocked; fi",
      "coproc guarded if git checkout feature/x; then :; fi",
      "coproc git -C { checkout feature/x",
      "function guarded if git checkout feature/x; then :; fi; guarded",
    ],
    mustAllow: ["git checkout main", "echo git checkout feature/x"],
  },
  {
    hook: "block-gh-pr-checkout.cjs",
    export: "classifyCommand",
    outcome: (fn, command) => (fn(command).block ? "deny" : "allow"),
    mustDeny: [
      "gh pr checkout 123",
      "gh pr co 123",
      "gh co 123",
      'eval "gh pr checkout 123"',
      "if gh pr checkout 123; then echo blocked; fi",
      "gh --hostname ghe.example.com pr checkout 123",
    ],
    mustAllow: [
      "gh pr diff 123",
      "gh pr comment 123",
      "echo gh pr checkout 123",
    ],
  },
];

/**
 * Run the behaviour probes. Returns a list of human-readable problems; empty
 * === healthy. Never throws — a guard that cannot even be loaded is reported as
 * a problem rather than crashing the canary.
 *
 * `options.load` overrides module loading with a `(basename) => module`
 * function so tests can inject a deliberately-broken guard.
 */
function evaluateGuardBehavior(options = {}) {
  const problems = [];
  const load =
    typeof options.load === "function"
      ? options.load
      : (basename) => require(path.join(__dirname, basename));

  for (const probe of BEHAVIOR_PROBES) {
    let fn;
    try {
      const mod = load(probe.hook);
      fn = mod && mod[probe.export];
    } catch (err) {
      problems.push(
        `${probe.hook} could not be loaded (${err && err.code ? err.code : "error"})`,
      );
      continue;
    }
    if (typeof fn !== "function") {
      problems.push(`${probe.hook} no longer exports ${probe.export}()`);
      continue;
    }

    // Each expected outcome ("deny" | "ask" | "allow") has its own command
    // table; a missing table is simply skipped. A classifier that throws is
    // read as the LEAST safe answer for the expectation — "allow" when we
    // wanted a deny/ask, "deny" when we wanted an allow — so a crashing guard
    // always reports as degraded rather than passing silently.
    const expectations = [
      ["deny", probe.mustDeny],
      ["ask", probe.mustAsk],
      ["allow", probe.mustAllow],
    ];
    const failures = [];
    for (const [expected, commands] of expectations) {
      if (!Array.isArray(commands)) continue;
      for (const command of commands) {
        let actual;
        try {
          actual = probe.outcome(fn, command);
        } catch {
          actual = expected === "allow" ? "deny" : "allow";
        }
        if (actual !== expected) {
          failures.push(
            `expected ${expected} for ${JSON.stringify(command)}, got ${actual}`,
          );
        }
      }
    }
    if (failures.length > 0) {
      problems.push(`${probe.hook} ${failures.join("; ")}`);
    }
  }

  return problems;
}

// --- Hook entrypoint ---------------------------------------------------------
// Does the IO: resolve path (incl. VERIFY_GUARD_SETTINGS override), read/parse
// settings, call evaluateGuardStack + evaluateGuardBehavior, print one warning
// line on problems (else silent), and fail open on any error. Always exits 0.
function main() {
  // Fail-open helper: a single one-line note, never a stack trace, never
  // non-zero. Collapse any embedded line breaks so it stays one line.
  const skip = (reason) => {
    const oneLine = String(reason).replace(/\s*[\r\n]+\s*/g, " ");
    process.stderr.write(`verify-guard-stack: skipped (${oneLine})\n`);
    process.exit(0);
  };

  const settingsPath =
    process.env.VERIFY_GUARD_SETTINGS ||
    path.join(__dirname, "..", "settings.json");

  let raw;
  try {
    raw = fs.readFileSync(settingsPath, "utf8");
  } catch (err) {
    skip(`cannot read settings.json: ${err && err.code ? err.code : "error"}`);
    return;
  }

  let settings;
  try {
    settings = JSON.parse(raw);
  } catch {
    skip("settings.json is not valid JSON");
    return;
  }

  const problems = [...evaluateGuardStack(settings), ...evaluateGuardBehavior()];
  if (problems.length === 0) {
    // Healthy — stay silent.
    process.exit(0);
  }

  process.stderr.write(
    `⚠️  GUARD STACK DEGRADED — ${problems.join("; ")}. ` +
      `Restore .claude/settings.json from git before continuing.\n`,
  );
  process.exit(0);
}

module.exports = {
  evaluateGuardStack,
  evaluateGuardBehavior,
  extractScriptPaths,
  main,
  BEHAVIOR_PROBES,
};

// Only run as a hook when invoked directly (not when require()'d by a test).
if (require.main === module) {
  try {
    main();
  } catch (err) {
    // Last-resort fail-open: a broken canary must never disrupt a session.
    // Collapse embedded line breaks so the skip note stays a single line.
    try {
      const reason = err && err.message ? err.message : "unexpected error";
      const oneLine = String(reason).replace(/\s*[\r\n]+\s*/g, " ");
      process.stderr.write(`verify-guard-stack: skipped (${oneLine})\n`);
    } catch {
      /* ignore */
    }
    process.exit(0);
  }
}
