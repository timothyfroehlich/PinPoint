#!/usr/bin/env node
// .claude/hooks/block-worktree-dispatch-from-linked.cjs
// PreToolUse hook (matcher: Agent): hard-blocks `Agent(isolation: "worktree")`
// dispatch when the CALLER is already inside a linked (non-primary) worktree.
//
// Upstream bug: https://github.com/anthropics/claude-code/issues/47548
// Dispatching a worktree-isolated subagent from a linked worktree silently
// switches the PARENT worktree's branch to the subagent's new branch — even at
// N=1. The parent then has someone else's branch checked out, and any later
// commit or merge lands on the wrong branch.
//
// This is NOT the bug the WorktreeCreate hook covers. That hook (PP-bg45) wraps
// `git worktree add` in an OS-level lock to serialise concurrent creation
// (#47266). It cannot help here: the branch switch happens in the parent
// regardless of concurrency.
//
// Before this hook the only mitigation was prose in CLAUDE.md asking the agent
// to "refuse and explain" — a request, not a guarantee. This makes it a
// guarantee.
//
// Fails OPEN in every ambiguous case: non-Agent tools, malformed payloads,
// non-worktree dispatch, the main worktree, non-repos, and any git error.
// Blocking is reserved for the one case we can prove: cwd IS a linked worktree
// AND the dispatch IS worktree-isolated.

const path = require("node:path");
const { execFileSync } = require("node:child_process");

// --- Pure classifier (unit-testable without git) -----------------------------
// Should this payload be considered a worktree-isolated Agent dispatch?
// Only the tool name and the `isolation` input matter here; the worktree
// question is answered separately by worktreeKind().
function isWorktreeDispatch(payload) {
  const p = payload || {};
  if ((p.tool_name || "") !== "Agent") return false;
  return (p.tool_input || {}).isolation === "worktree";
}

// --- Git-backed worktree classification --------------------------------------
// MAIN worktree ⟺ git-dir === git-common-dir (same test used by
// block-main-worktree-branch-switch.cjs). Linked worktrees differ: their
// git-dir is <common>/worktrees/<name>.
//
// Three-state on purpose. `isMainWorktree()` in the sibling hook collapses
// errors to `false`, which is correct there (false → allow) but would be
// fail-CLOSED here, where "not main" is the blocking condition. An unreadable
// or non-repo cwd must ALLOW, not block.
function worktreeKind(cwd) {
  let out;
  try {
    out = execFileSync("git", ["rev-parse", "--git-dir", "--git-common-dir"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "unknown"; // Not a repo / git failed → fail open.
  }

  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return "unknown";

  const gitDir = path.resolve(cwd, lines[0]);
  const gitCommonDir = path.resolve(cwd, lines[1]);
  return gitDir === gitCommonDir ? "main" : "linked";
}

module.exports = { isWorktreeDispatch, worktreeKind };

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
      process.exit(0); // Malformed payload → fail open.
    }

    // 1. Cheap pre-filter: not a worktree-isolated Agent dispatch → allow
    //    without shelling out to git.
    if (!isWorktreeDispatch(payload)) {
      process.exit(0);
    }

    // 2. Detection cwd comes from the payload, NOT CLAUDE_PROJECT_DIR — which
    //    is a stable project-root path and would misclassify a lead relocated
    //    via EnterWorktree (exactly the case this hook exists for) as the main
    //    worktree. Same convention as block-main-worktree-branch-switch.cjs and
    //    normalize-workspace-paths.cjs.
    const detectCwd = payload.cwd || process.cwd();

    // 3. Only "linked" blocks. "main" is the supported dispatch site;
    //    "unknown" fails open.
    if (worktreeKind(detectCwd) !== "linked") {
      process.exit(0);
    }

    console.error(
      `Worktree dispatch blocked: you are inside a LINKED worktree (${detectCwd}). ` +
        `Dispatching Agent(isolation:"worktree") from here silently switches THIS worktree's ` +
        `branch to the subagent's new branch — upstream bug anthropics/claude-code#47548, ` +
        `which the WorktreeCreate hook does NOT fix. ` +
        `Dispatch from the main worktree instead (the original clone, where .git is a directory), ` +
        `or do the work here yourself without a subagent. ` +
        `If Tim explicitly accepts the risk, he can run the dispatch from his own session.`
    );
    process.exit(2);
  });
}
