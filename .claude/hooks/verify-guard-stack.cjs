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

function skip(reason) {
  // Fail-open: a single one-line note, never a stack trace, never non-zero.
  process.stderr.write(`verify-guard-stack: skipped (${reason})\n`);
  process.exit(0);
}

function main() {
  const path = require("node:path");
  const fs = require("node:fs");

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

  // permissions.deny / permissions.ask must both be present, non-empty arrays.
  const missingPerms = [];
  const perms = settings?.permissions;
  const denyOk = Array.isArray(perms?.deny) && perms.deny.length > 0;
  const askOk = Array.isArray(perms?.ask) && perms.ask.length > 0;
  if (!denyOk) missingPerms.push("permissions.deny empty/absent");
  if (!askOk) missingPerms.push("permissions.ask empty/absent");

  if (missingHooks.length === 0 && missingPerms.length === 0) {
    // Healthy — stay silent.
    process.exit(0);
  }

  const parts = [];
  if (missingHooks.length > 0) {
    parts.push(`missing PreToolUse hooks: ${missingHooks.join(", ")}`);
  }
  if (missingPerms.length > 0) {
    parts.push(missingPerms.join("; "));
  }

  process.stderr.write(
    `⚠️  GUARD STACK DEGRADED — ${parts.join("; ")}. ` +
      `Restore .claude/settings.json from git before continuing.\n`,
  );
  process.exit(0);
}

try {
  main();
} catch (err) {
  // Last-resort fail-open: a broken canary must never disrupt a session.
  try {
    process.stderr.write(
      `verify-guard-stack: skipped (${err && err.message ? err.message : "unexpected error"})\n`,
    );
  } catch {
    /* ignore */
  }
  process.exit(0);
}
