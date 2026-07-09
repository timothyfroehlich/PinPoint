#!/usr/bin/env node
/**
 * SessionStart hook: Guard-stack integrity canary (warn-only, fail-open).
 *
 * On 2026-07-05 a settings.json rewrite silently deleted PinPoint's entire
 * PreToolUse guard-hook stack + the permissions deny/ask block, and the
 * session ran GUARDLESS for ~1.5h before it was caught. Nothing detected it.
 *
 * This canary reads .claude/settings.json at session start and warns (to
 * stderr) if any expected PreToolUse guard hook is missing from the wired
 * command strings, or if permissions.deny / permissions.ask have been
 * stripped. It is PURELY INFORMATIONAL:
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

// Keep in sync when adding/removing a PreToolUse guard hook.
const EXPECTED_GUARD_HOOKS = [
  "block-dangerous-commands.cjs",
  "normalize-workspace-paths.cjs",
  "inject-beads-actor.cjs",
  "block-bad-shell-patterns.cjs",
  "block-heavy-under-pressure.cjs",
  "block-direct-merge.cjs",
  "block-main-worktree-branch-switch.cjs",
];

// --- Pure evaluator (unit-testable without fs / exit / printing) -------------
// Given a parsed settings object, return the list of guard-stack problems as
// human-readable strings. Empty array === healthy. No IO, no printing, no exit.
//
// Problems reported:
//   - `missing PreToolUse hooks: <basename>, ...` when any EXPECTED_GUARD_HOOKS
//     basename is absent from every wired PreToolUse command string.
//   - `permissions.deny empty/absent` / `permissions.ask empty/absent` when
//     either is not a non-empty array.
function evaluateGuardStack(settings) {
  const problems = [];

  // Collect every wired PreToolUse command string.
  const preToolUse = settings?.hooks?.PreToolUse;
  const commands = [];
  if (Array.isArray(preToolUse)) {
    for (const entry of preToolUse) {
      const inner = entry?.hooks;
      if (!Array.isArray(inner)) continue;
      for (const h of inner) {
        if (typeof h?.command === "string") {
          commands.push(h.command);
        }
      }
    }
  }

  const missingHooks = EXPECTED_GUARD_HOOKS.filter(
    (basename) => !commands.some((cmd) => cmd.includes(basename)),
  );
  if (missingHooks.length > 0) {
    problems.push(`missing PreToolUse hooks: ${missingHooks.join(", ")}`);
  }

  // permissions.deny / permissions.ask must both be present, non-empty arrays.
  const perms = settings?.permissions;
  const denyOk = Array.isArray(perms?.deny) && perms.deny.length > 0;
  const askOk = Array.isArray(perms?.ask) && perms.ask.length > 0;
  if (!denyOk) problems.push("permissions.deny empty/absent");
  if (!askOk) problems.push("permissions.ask empty/absent");

  return problems;
}

// --- Hook entrypoint ---------------------------------------------------------
// Does the IO: resolve path (incl. VERIFY_GUARD_SETTINGS override), read/parse
// settings, call evaluateGuardStack, print one warning line on problems (else
// silent), and fail open on any error. Always exits 0.
function main() {
  const path = require("node:path");
  const fs = require("node:fs");

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

  const problems = evaluateGuardStack(settings);
  if (problems.length === 0) {
    // Healthy — stay silent.
    process.exit(0);
    return;
  }

  process.stderr.write(
    `⚠️  GUARD STACK DEGRADED — ${problems.join("; ")}. ` +
      `Restore .claude/settings.json from git before continuing.\n`,
  );
  process.exit(0);
}

module.exports = { evaluateGuardStack, main };

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
