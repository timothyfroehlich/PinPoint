#!/usr/bin/env node
// .claude/hooks/block-main-worktree-branch-switch.cjs
// PreToolUse hook: hard-blocks git branch switches in the MAIN worktree unless
// the target branch is `main`. The root checkout is read-only and stays on main
// (AGENTS.md §2.2.5). Branch work belongs in a dedicated worktree.
//
// Incident (2026-05-31): a `git checkout <feature-branch>` ran in the MAIN
// worktree, switching it off `main`; a later `git merge --ff-only origin/main`
// then advanced the wrong branch and clobbered another session's state.
//
// Bypass: presence of .claude-worktree-switch-bypass in repo root (single-use,
// deleted on fire).
//
// Fails OPEN in every ambiguous case: non-Bash tools, malformed payloads,
// non-git commands, git errors, and (critically) linked worktrees all ALLOW.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// --- Pure classifier (unit-testable without git) -----------------------------
// Decide whether a shell command string should be BLOCKED because it switches
// the current checkout to a branch other than `main`.
//
// Returns { block: boolean, detail: string }.
//
// Rules (a command BLOCKS if ANY of its segments blocks):
//   - File restore  → ALLOW: a `git checkout` segment containing a `--` token.
//   - Target = main  → ALLOW: `git checkout main`, `git switch main`.
//   - Otherwise BLOCK: `git checkout <other-branch>`, `git switch <other-branch>`,
//     `git checkout -b|-B <name>`, `git switch -c|-C|--create <name>`,
//     `git checkout -`, `git switch -`.
function classifyCommand(command) {
  const cmd = String(command || "");
  // Split on shell separators: && || ; |
  const segments = cmd.split(/&&|\|\||;|\|/);

  for (const rawSegment of segments) {
    const segment = rawSegment.trim();
    if (!segment) continue;

    // Tokenize on whitespace. Good enough for the flag/branch checks below.
    const tokens = segment.split(/\s+/).filter(Boolean);

    // Resolve the effective command of the segment by skipping:
    //   (a) leading environment-assignment tokens (VAR=value, VAR+=value, etc.)
    //   (b) leading wrapper commands that do not consume the command slot
    //       themselves: sudo, env, command, time, nice.
    // Only if the resulting resolved command token is exactly "git" does this
    // segment count as a git invocation. Anything else (e.g. `echo git checkout`,
    // `rg git checkout`) is NOT a git invocation → skip to the next segment.
    //
    // Fail-open on wrappers-with-flags: if a wrapper is followed by its own flags
    // (e.g. `sudo -u root git checkout`) before `git`, we stop scanning wrappers
    // the moment we see a flag-like token, so the segment ALLOWS (the resolved
    // command would be the flag, not `git`). This is intentionally conservative.
    const WRAPPERS = new Set(["sudo", "env", "command", "time", "nice"]);
    const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*[+:]?=/;

    let cmdIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (ENV_ASSIGN.test(t)) continue; // skip VAR=value
      if (WRAPPERS.has(t)) continue;    // skip wrapper command itself
      cmdIdx = i;
      break;
    }
    if (cmdIdx === -1 || tokens[cmdIdx] !== "git") continue;

    // From here, `tokens[cmdIdx]` is exactly `git`.
    const gitIdx = cmdIdx;

    // Git global options that consume the NEXT token as their value
    // (e.g. `git -C path checkout`, `git --git-dir=... ` uses `=` so is self-contained).
    const optsWithSeparateArg = new Set([
      "-C",
      "-c",
      "--git-dir",
      "--work-tree",
      "--namespace",
      "--exec-path",
      "--super-prefix",
      "--config-env",
    ]);

    let subIdx = -1;
    let sub = "";
    for (let i = gitIdx + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "checkout" || t === "switch") {
        subIdx = i;
        sub = t;
        break;
      }
      if (t.startsWith("-")) {
        // A global option. If it consumes a separate argument, skip that too.
        if (optsWithSeparateArg.has(t)) i++;
        continue;
      }
      // First non-option, non-value token after `git` that isn't checkout/switch
      // → this isn't a checkout/switch invocation.
      break;
    }
    if (subIdx === -1) continue;

    // Arguments after the subcommand.
    const args = tokens.slice(subIdx + 1);

    // File restore: presence of a bare `--` token means path-restore form.
    // ALLOW: `git checkout -- path`, `git checkout <ref> -- path`.
    if (args.includes("--")) {
      continue;
    }

    // Branch-creation flags → always a branch switch → BLOCK.
    const createFlags =
      sub === "checkout"
        ? new Set(["-b", "-B"])
        : new Set(["-c", "-C", "--create"]);

    let hasCreateFlag = false;
    let target = "";
    for (const a of args) {
      if (createFlags.has(a)) {
        hasCreateFlag = true;
        continue;
      }
      if (a.startsWith("-")) {
        // Other flag (e.g. --quiet, --detach, -). `-` alone is the
        // previous-branch shorthand and is NOT a generic flag — handle below.
        if (a === "-") {
          // `git checkout -` / `git switch -` → switch to previous branch → BLOCK.
          return {
            block: true,
            detail: `git ${sub} - (previous branch)`,
          };
        }
        continue;
      }
      // First positional non-flag token is the target ref/branch.
      target = a;
      break;
    }

    if (hasCreateFlag) {
      return {
        block: true,
        detail: `git ${sub} ${sub === "checkout" ? "-b/-B" : "-c/-C/--create"} ${target || "<name>"}`.trim(),
      };
    }

    if (target === "") {
      // `git switch` with no target is invalid; `git checkout` with no positional
      // and no create flag (e.g. `git checkout --quiet`) is unusual. Be safe but
      // do not block a no-op — nothing to switch to. ALLOW.
      continue;
    }

    // Strip a single pair of surrounding matching quotes so `git checkout "main"`
    // / `git checkout 'main'` compare equal to `main` and ALLOW.
    const unquoted =
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
        ? target.slice(1, -1)
        : target;

    if (unquoted === "main") {
      continue; // ALLOW switching to main.
    }

    return { block: true, detail: `git ${sub} ${unquoted}` };
  }

  return { block: false, detail: "" };
}

module.exports = { classifyCommand };

// --- Git-backed main-worktree detection --------------------------------------
// MAIN worktree ⟺ git-dir === git-common-dir. Linked worktrees differ.
// Fails OPEN (returns false → ALLOW) on any git error / non-repo.
function isMainWorktree(cwd) {
  try {
    const out = execFileSync(
      "git",
      ["rev-parse", "--git-dir", "--git-common-dir"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;
    const gitDir = path.resolve(cwd, lines[0]);
    const gitCommonDir = path.resolve(cwd, lines[1]);
    return gitDir === gitCommonDir;
  } catch {
    return false; // Not a repo / git failed → fail open.
  }
}

// --- Hook entrypoint ----------------------------------------------------------
// Only run as a hook when invoked directly (not when require()'d by a test).
if (require.main === module) {
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(input);
    } catch {
      // Malformed payload — fail open to avoid breaking other hooks.
      process.exit(0);
    }

    if ((payload.tool_name || "") !== "Bash") {
      process.exit(0);
    }

    const cmd = String((payload.tool_input || {}).command || "");

    // 1. Cheap pre-filter: no git checkout/switch anywhere → allow without git calls.
    if (!/\bgit\b[\s\S]*\b(?:checkout|switch)\b/.test(cmd)) {
      process.exit(0);
    }

    // Use the per-invocation working directory from the stdin payload, NOT
    // CLAUDE_PROJECT_DIR (a stable project-root path). Worktree detection must
    // reflect where the command actually runs: a lead relocated via EnterWorktree
    // or an Agent-Team teammate operates in a LINKED worktree whose root differs
    // from the project root — using CLAUDE_PROJECT_DIR would misclassify them as
    // the MAIN worktree and wrongly block legit switches. Repo convention: see
    // normalize-workspace-paths.cjs (`input.cwd || process.cwd()`) and the
    // push-check.sh / definition-of-done.sh `jq -r '.cwd'` reads.
    const detectCwd = payload.cwd || process.cwd();

    // 2. Single-use bypass sentinel. In the main worktree the cwd and root
    // coincide, so the sentinel lives at the cwd root — same detectCwd.
    const sentinel = path.join(detectCwd, ".claude-worktree-switch-bypass");
    if (fs.existsSync(sentinel)) {
      try {
        fs.unlinkSync(sentinel);
      } catch {}
      process.exit(0);
    }

    // 3. Main-worktree detection. Linked worktree / non-repo / git error → allow.
    if (!isMainWorktree(detectCwd)) {
      process.exit(0);
    }

    // 4. Classify.
    const { block, detail } = classifyCommand(cmd);
    if (!block) {
      process.exit(0);
    }

    // 5. Block.
    console.error(
      `Branch switch blocked in the MAIN worktree: ${detail}. ` +
        `The root checkout is read-only and stays on \`main\` (AGENTS.md §2.2.5) — ` +
        `switching it off main lets a later \`git merge\` advance the wrong branch and clobber another session's state. ` +
        `Do branch work in a dedicated worktree: \`git worktree add <path> -b <branch> origin/main\`, ` +
        `or dispatch an Agent(isolation:"worktree"). ` +
        `Override with: touch .claude-worktree-switch-bypass (single-use sentinel, auto-deleted on hook fire).`
    );
    process.exit(2);
  });
}
