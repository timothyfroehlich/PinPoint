#!/usr/bin/env node
/**
 * DISABLED — not registered in .claude/settings.json since 2026-08-14 (PP-yv19).
 *
 * Kept on disk, with its tests, because re-enabling is one settings entry plus
 * three expected-hook list entries (verify-guard-stack.cjs, its unit test,
 * scripts/tests/test_node_hook_paths.py). Delete all of it if nothing misses it.
 *
 * Why it was turned off: what it buys is fewer permission prompts when an agent
 * spells a repo path absolutely. What it cost, over three review rounds on
 * PR #1880, was a silent path corruption that broke crabbox twice, two
 * command mis-targeting bugs, and a `permissionDecision: "allow"` that skipped
 * the `permissions.ask` prompt on `rm -rf` and `git reset --hard`. Rewriting
 * arbitrary shell text is a poor trade for that.
 *
 * The prompt it dodged is also solvable without rewriting anything: Bash
 * permission rules match the literal command string with `*` wildcards, so an
 * absolute-path allow rule covers the case directly. The machine-local settings
 * already carry one, of the shape `Bash(bash <abs repo root>WILDCARD/scripts/
 * workflow/...)`, where the wildcard right after the repo root makes it cover
 * worktrees too. (Written that way here because a literal `*` followed by a
 * slash would end this comment block — which is exactly how this note first
 * broke the file.)
 *
 * ---------------------------------------------------------------------------
 *
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
 * ---------------------------------------------------------------------------
 * What makes this hook dangerous, and the four guards that hold it back
 * ---------------------------------------------------------------------------
 *
 * An absolute path and a root-relative one only mean the same thing when the
 * command runs from the root, on this machine. Every guard below exists because
 * some case broke that assumption, and a broken rewrite is invisible: the
 * transcript records what the agent wrote, not what ran (PP-xbfn).
 *
 * 1. **Only prefixes that name THIS machine's repo root.** The matcher used to
 *    hardcode `/home/froeht/Code/PinPoint`, which on the Mac names no local
 *    directory at all — it is Bazzite's path. So the hook rewrote paths meant
 *    for the *remote* box, e.g. a crabbox invocation carrying
 *    `CRABBOX_STATIC_WORK_ROOT=/var/home/froeht/Code/PinPoint/.claude/...`.
 *
 * 2. **Only at a path boundary.** Bazzite's home is `/var/home/froeht` and
 *    `/home` is a symlink to it, so an unanchored matcher found
 *    `/home/froeht/Code/PinPoint/` in the MIDDLE of a `/var/home/...` path and
 *    stripped it, leaving `/var` glued to the tail: `/var.claude/worktrees`.
 *    crabbox died on `mkdir: cannot create directory '/var.claude'`.
 *
 * 3. **Only when cwd IS the repo root**, and only for commands that keep it
 *    that way. `cd /tmp && bash <root>/scripts/x.sh` would otherwise become
 *    `cd /tmp && bash scripts/x.sh`, i.e. `/tmp/scripts/x.sh`.
 *
 * 4. **Never for a command that hands the text to another machine or
 *    namespace.** `ssh bazzite 'ls <root>/scripts'` names the *remote* root,
 *    which on Bazzite is spelled exactly like the local one — guard 1 cannot
 *    tell them apart, so the whole command is skipped instead.
 *
 * 5. **Never auto-allow.** The hook rewrites and then gets out of the way; the
 *    rewritten command still goes through normal permission evaluation. Sending
 *    `permissionDecision: "allow"` turned `rm -rf <root>/src/app` into an
 *    auto-approved `rm -rf src/app`, skipping the `permissions.ask` prompt.
 *
 * Guards 3 and 4 are deliberately blunt: skipping a rewrite that would have been
 * fine costs one permission prompt, while making a wrong one costs a silently
 * mis-targeted command. Bias every judgement call toward skipping.
 */

const fs = require("fs");
const path = require("path");

/**
 * Command words that make a rewrite unsafe, because after them the path is no
 * longer interpreted from this cwd on this machine.
 *
 * - directory changes: the relative path would resolve somewhere else
 * - remote/namespace execution: the path names a filesystem we are not on
 */
const CONTEXT_SHIFTING_WORDS = [
  // changes cwd
  "cd",
  "pushd",
  "popd",
  "chdir",
  // hands the command to another host or namespace
  "ssh",
  "scp",
  "sftp",
  "rsync",
  "crabbox",
  "docker",
  "podman",
  "kubectl",
  "nsenter",
  "chroot",
];

// Matched as a whole word ANYWHERE in the command, not just in command
// position. Command position is not detectable by regex: a leading
// `VAR=value`, a wrapper (`sudo`, `env`, `time`, `xargs`, `nohup`), a quoted
// `-c` payload, or a `do`/`then` keyword all put the word somewhere an
// anchored pattern cannot see — and the first of those is the PR's own
// motivating command, `CRABBOX_STATIC_WORK_ROOT=… crabbox …`.
//
// The cost is false positives: `cat docker-compose.yml` and `echo "cd there"`
// both suppress the rewrite. That is one permission prompt, which is the
// cheaper error — see the header.
const CONTEXT_SHIFT_REGEX = new RegExp(
  String.raw`\b(?:${CONTEXT_SHIFTING_WORDS.join("|")})\b`
);

// `-C <dir>` — git, make and tar all use it to run somewhere else.
const CHDIR_FLAG_REGEX = /(?:^|\s)-C(?:\s|=)/;

/**
 * True when the command changes where a relative path would resolve.
 *
 * @param {string} command
 * @returns {boolean}
 */
function shiftsContext(command) {
  return CONTEXT_SHIFT_REGEX.test(command) || CHDIR_FLAG_REGEX.test(command);
}

/** Escape a literal string for embedding in a RegExp. */
function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when two paths name the same directory on this machine.
 *
 * Compares resolved symlinks, not just lexical form: on Bazzite the repo root
 * has two spellings (`/home/...` and `/var/home/...`), and on macOS `/tmp` and
 * `/private/tmp` are the same place.
 *
 * @param {string} a
 * @param {string} b
 * @param {(p: string) => string} [realpath]
 */
function samePath(a, b, realpath = fs.realpathSync) {
  if (path.resolve(a) === path.resolve(b)) return true;
  try {
    return realpath(a) === realpath(b);
  } catch {
    // One of them does not exist — they are not the same directory.
    return false;
  }
}

/**
 * The absolute prefixes that name `repoRoot` on this machine.
 *
 * The `/home` <-> `/var/home` sibling is offered only when both spellings
 * actually resolve to the same directory. On Bazzite (Fedora Atomic) they do,
 * so an agent that types either form gets the rewrite. On any other Linux with
 * the repo at `/home/...`, `/var/home/...` is a different — usually
 * nonexistent — directory, and synthesizing it unchecked would reintroduce the
 * original bug in mirror image.
 *
 * @param {string} repoRoot
 * @param {(p: string) => string} [realpath]
 * @returns {string[]} deduped, longest first
 */
function workspacePrefixes(repoRoot, realpath = fs.realpathSync) {
  const roots = new Set();

  const add = (p) => {
    if (!p || p === "/") return;
    roots.add(p.replace(/\/+$/, ""));
  };

  add(repoRoot);
  try {
    add(realpath(repoRoot));
  } catch {
    // Root does not resolve — the literal spelling is all we have.
  }

  for (const root of [...roots]) {
    let sibling = null;
    if (root.startsWith("/var/home/")) sibling = root.slice("/var".length);
    else if (root.startsWith("/home/")) sibling = `/var${root}`;

    if (sibling && samePath(sibling, root, realpath)) add(sibling);
  }

  return [...roots].sort((a, b) => b.length - a.length);
}

/**
 * Build the matcher for a set of workspace prefixes.
 *
 * `(?<![\w./@{}~-])` requires the match to START a path: the character before
 * it must not be one that could continue a path. That is what stops a prefix
 * from matching inside a longer, unrelated path (guard 2).
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
 * `repoRoot`, but only where the target exists under `repoRoot` and the
 * command does not move the ground out from under a relative path.
 *
 * Pure apart from the injected probes, so it is unit-testable.
 *
 * @param {string} command
 * @param {string} repoRoot
 * @param {{ exists?: (p: string) => boolean, realpath?: (p: string) => string }} [probes]
 * @returns {{ modified: string, rewrites: string[] }}
 */
function normalizeCommand(command, repoRoot, probes = {}) {
  const { exists = fs.existsSync, realpath = fs.realpathSync } = probes;

  // Guards 3 and 4: after a `cd` or an `ssh`, a relative path means something
  // else. Leave the whole command alone rather than guess at its scope.
  if (shiftsContext(command)) {
    return { modified: command, rewrites: [] };
  }

  const prefixes = workspacePrefixes(repoRoot, realpath);
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

  // Guard 3: a root-relative path only means the same thing as the absolute one
  // when the command starts at the root. From a subdirectory, stay out of the
  // way. Compared through symlinks, since git and the agent can spell the same
  // directory differently.
  if (!samePath(agentCwd, repoRoot)) {
    process.exit(0);
  }

  const { modified, rewrites } = normalizeCommand(command, repoRoot);

  if (rewrites.length > 0) {
    const reason =
      `Auto-fixed ${rewrites.length} absolute path(s) to relative:\n` +
      rewrites.join("\n") +
      "\nUse relative paths from the start — they match the settings.json allowlist.";

    // No `permissionDecision`. The hook rewrites the command and then gets out
    // of the way, so the rewritten command goes through normal permission
    // evaluation.
    //
    // It used to send `"allow"`, which short-circuits that evaluation. Harmless
    // while the matcher hardcoded a path that names nothing on the Mac — the
    // hook never fired here — but fixing the matcher made it reachable, and
    // `rm -rf <root>/src/app` came back as an auto-allowed `rm -rf src/app`
    // even though `Bash(rm -rf:*)` is on `permissions.ask`. Same for
    // `git reset --hard`, `git clean`, `git branch -D`, `docker volume rm`.
    //
    // Auto-allow was never needed for the hook's purpose: the point is that the
    // REWRITTEN path matches the allowlist, and the allowlist grants that by
    // itself.
    const decision = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
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

module.exports = {
  normalizeCommand,
  workspacePrefixes,
  shiftsContext,
  samePath,
};

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(
      `[normalize-workspace-paths] Hook error: ${err?.message ?? err}\n`
    );
    process.exit(0);
  });
}
