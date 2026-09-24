#!/usr/bin/env node
// PreToolUse (Bash) hook: blocks `git checkout|switch <anything but main>` in the
// MAIN worktree, which is read-only and stays on `main` (AGENTS.md §2.2.5;
// incident 2026-05-31: a later `git merge` advanced the wrong branch there).
// Deliberately a regex, not a shell parser. Allowed: commands that `cd`
// elsewhere, `git -C <path> …` (never matches: `-C` precedes the subcommand),
// file restores (`git checkout [<ref>] -- <paths>`, `--theirs`/`--ours`/`-p`,
// `git checkout .`), linked worktrees,
// malformed payloads, and git errors.

const path = require("node:path");
const { execFileSync } = require("node:child_process");

// `git checkout|switch <args>` at command position, up to the next shell operator;
// MOVES are flags that leave main even without a positional target.
const SWITCH = /(?:^|[;&|(\n])\s*(git\s+(?:checkout|switch)\b([^;&|)\n]*))/g;
const MOVES = new Set(["-", "-b", "-B", "-c", "-C", "--create", "--orphan", "--detach"]);
// Flags that only make sense with paths, so the command restores files.
const FILE_FLAGS = new Set(["--", "--theirs", "--ours", "-p", "--patch", "--pathspec-from-file"]);

/** The offending `git checkout|switch …` text, or "" when the command is fine. */
function findBranchSwitch(command) {
  if (/\bcd\s/.test(command)) return "";
  for (const [, match, rest] of command.matchAll(SWITCH)) {
    const args = rest.split(/\s+/).filter(Boolean).map((a) => a.replace(/^["']|["']$/g, ""));
    if (args.some((a) => FILE_FLAGS.has(a))) continue;
    const target = args.find((a) => !a.startsWith("-"));
    if (target === ".") continue;
    if (args.some((a) => MOVES.has(a)) || (target && target !== "main")) return match.trim();
  }
  return "";
}

// MAIN worktree ⟺ git-dir === git-common-dir (also true from a subdirectory).
function isMainWorktree(cwd) {
  try {
    const opts = { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
    const out = execFileSync("git", ["rev-parse", "--git-dir", "--git-common-dir"], opts);
    const [gitDir, commonDir] = out.trim().split("\n");
    return path.resolve(cwd, gitDir) === path.resolve(cwd, commonDir);
  } catch {
    return false;
  }
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(input) ?? {};
  } catch {
    // Malformed payload → allow.
  }
  const detail = payload.tool_name === "Bash" ? findBranchSwitch(String(payload.tool_input?.command ?? "")) : "";
  if (!detail || !isMainWorktree(payload.cwd || process.cwd())) return;
  console.error(
    `Branch switch blocked in the MAIN worktree: ${detail}. The root checkout is read-only and stays on \`main\` ` +
      `(AGENTS.md §2.2.5) — switching it off main lets a later \`git merge\` advance the wrong branch and clobber ` +
      `another session's state. Restoring files? Use \`git checkout -- <paths>\` or \`git restore\`. ` +
      `Do branch work in a dedicated worktree: ` +
      `\`git worktree add <path> -b <branch> origin/main\`, or dispatch an Agent(isolation:"worktree").`
  );
  process.exitCode = 2;
});
