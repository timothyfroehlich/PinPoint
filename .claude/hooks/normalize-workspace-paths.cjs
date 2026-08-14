#!/usr/bin/env node
/**
 * PreToolUse hook: Rewrites unnecessary absolute workspace paths to relative.
 *
 * When an agent in a worktree runs a command with an absolute path like:
 *   bash /var/home/froeht/Code/PinPoint/scripts/workflow/merge-pr.sh 1039 ...
 *
 * This hook rewrites it to:
 *   bash scripts/workflow/merge-pr.sh 1039 ...
 *
 * Why: The settings.json allowlist uses relative paths. Absolute paths don't
 * match, causing unnecessary permission prompts. This hook auto-fixes the
 * command and tells the agent to use relative paths next time.
 *
 * The prefixes it matches are derived from THIS machine's repo root, not
 * hardcoded. Three rules keep the rewrite from changing what a command means
 * (all three learned from PP-xbfn):
 *
 * 1. **Only this machine's repo root.** The matcher used to hardcode
 *    `/home/froeht/Code/PinPoint`, which on the Mac names no local directory at
 *    all — it is Bazzite's path. So the hook rewrote paths that were meant for
 *    the *remote* box. A crabbox invocation carrying
 *    `CRABBOX_STATIC_WORK_ROOT=/var/home/froeht/Code/PinPoint/.claude/worktrees/...`
 *    is a remote path; relativizing it is wrong however it is spelled. Matching
 *    only the local root leaves it alone.
 *
 * 2. **Match at a path boundary.** Bazzite's home is `/var/home/froeht` and
 *    `/home` is a symlink to it, so an unanchored matcher found
 *    `/home/froeht/Code/PinPoint/` in the MIDDLE of a `/var/home/...` path and
 *    stripped it, leaving the orphaned `/var` glued to the tail:
 *    `/var.claude/worktrees`. crabbox then died on
 *    `mkdir: cannot create directory '/var.claude'`. The transcript records the
 *    command the agent wrote — the rewrite happens after — so the corruption is
 *    invisible until something downstream fails.
 *
 * 3. **Only when cwd IS the repo root.** A root-relative path is only equivalent
 *    to the absolute one when the command runs from the root. From a
 *    subdirectory the rewrite would silently retarget the file.
 */

const fs = require("fs");
const path = require("path");

/** Escape a literal string for embedding in a RegExp. */
function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The absolute prefixes that name `repoRoot` on this machine.
 *
 * Includes the symlinked spelling, so a Bazzite agent that types the
 * `/home/froeht/...` form still gets the rewrite even though git reports the
 * canonical `/var/home/froeht/...`.
 *
 * @param {string} repoRoot
 * @returns {string[]} deduped, longest first
 */
function workspacePrefixes(repoRoot) {
  const roots = new Set();

  const add = (p) => {
    if (!p || p === "/") return;
    roots.add(p.replace(/\/+$/, ""));
  };

  add(repoRoot);
  try {
    add(fs.realpathSync(repoRoot));
  } catch {
    // Root does not resolve — the literal spelling is all we have.
  }

  // /home <-> /var/home are the same directory on Bazzite (Fedora Atomic).
  for (const root of [...roots]) {
    if (root.startsWith("/var/home/")) add(root.slice("/var".length));
    else if (root.startsWith("/home/")) add(`/var${root}`);
  }

  return [...roots].sort((a, b) => b.length - a.length);
}

/**
 * Build the matcher for a set of workspace prefixes.
 *
 * `(?<![\w./@{}~-])` requires the match to START a path: the character before
 * it must not be one that could continue a path. That is what stops a prefix
 * from matching inside a longer, unrelated path.
 */
function buildRegex(prefixes) {
  const alternation = prefixes.map(escapeRegExp).join("|");
  return new RegExp(
    `(?<![\\w./@{}~-])(?:${alternation})/([\\w./@{}-][^\\s"']*)`,
    "g"
  );
}

/**
 * Rewrite absolute workspace paths in `command` to paths relative to
 * `repoRoot`, but only where the target actually exists under `repoRoot`.
 *
 * Pure apart from the injected `exists` probe, so it is unit-testable.
 *
 * @param {string} command
 * @param {string} repoRoot
 * @param {(p: string) => boolean} [exists]
 * @returns {{ modified: string, rewrites: string[] }}
 */
function normalizeCommand(command, repoRoot, exists = fs.existsSync) {
  const prefixes = workspacePrefixes(repoRoot);
  if (prefixes.length === 0) {
    return { modified: command, rewrites: [] };
  }

  const rewrites = [];
  const modified = command.replace(
    buildRegex(prefixes),
    (fullAbsPath, relativePart) => {
      // Only rewrite if the file exists relative to the repo/worktree root.
      if (!exists(path.join(repoRoot, relativePart))) {
        return fullAbsPath;
      }
      rewrites.push(`  ${fullAbsPath} -> ${relativePart}`);
      return relativePart;
    }
  );

  return { modified, rewrites };
}

async function main() {
  let inputData = "";
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  if (!inputData.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(inputData);
  } catch {
    process.exit(0);
  }

  const command = input.tool_input?.command;
  if (!command) {
    process.exit(0);
  }

  const agentCwd = input.cwd || process.cwd();

  // Resolve the worktree/repo root.
  let repoRoot = agentCwd;
  try {
    const { execSync } = require("child_process");
    repoRoot =
      execSync("git rev-parse --show-toplevel", {
        cwd: agentCwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || agentCwd;
  } catch {
    // Not in a git repo — fall back to cwd
  }

  // A root-relative path only means the same thing as the absolute one when the
  // command runs from the root. From a subdirectory, stay out of the way.
  if (path.resolve(agentCwd) !== path.resolve(repoRoot)) {
    process.exit(0);
  }

  const { modified, rewrites } = normalizeCommand(command, repoRoot);

  if (rewrites.length > 0) {
    const reason =
      `Auto-fixed ${rewrites.length} absolute path(s) to relative:\n` +
      rewrites.join("\n") +
      "\nUse relative paths from the start — they match the settings.json allowlist.";

    const decision = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: reason,
        updatedInput: { ...input.tool_input, command: modified },
      },
    };
    process.stdout.write(JSON.stringify(decision));
    process.exit(0);
  }

  // No rewrites needed
  process.exit(0);
}

module.exports = { normalizeCommand, workspacePrefixes };

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(
      `[normalize-workspace-paths] Hook error: ${err?.message ?? err}\n`
    );
    process.exit(0);
  });
}
