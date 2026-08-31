#!/usr/bin/env node
// .claude/hooks/block-gh-pr-checkout.cjs
// PreToolUse hook: hard-blocks `gh pr checkout` and its aliases in EVERY worktree.
//
// `gh pr checkout <n>` creates a local branch (typically `prNNNN`) and switches
// the current checkout onto it. Run inside a session's worktree it silently
// strands the lead agent's subsequent commits on that throwaway branch — the
// same worktree-dispatch hazard class as CLAUDE.md's documented branch-switch
// bugs (anthropics/claude-code#47548), except the vector is a *review* subagent
// mutating shared git state rather than worktree dispatch.
//
// Incident (2026-07-22, PP-p53z): a /code-review subagent ran `gh pr checkout
// 1727` in the parent session's worktree, creating `pr1727` and switching onto
// it; the lead's next commit landed on `pr1727` instead of the feature branch.
// Caught only because the commit output printed an unexpected branch name.
//
// WHY A SEPARATE HOOK from block-main-worktree-branch-switch.cjs: that guard
// only fires in the MAIN worktree and matches `git checkout`/`git switch`. This
// vector is the opposite — a LINKED worktree, and a `gh` command, not a `git`
// one. `gh pr checkout` has no legitimate use in this repo (branch work is done
// via `git worktree add`, and PRs are inspected with the read-only `gh pr diff`
// / `gh pr view`), so it is blocked everywhere unconditionally.
//
// Fails OPEN in every ambiguous case: non-Bash tools, malformed payloads, and
// anything the shared resolver cannot statically prove invokes PR checkout.

const { resolveCommand } = require("./lib/resolve-command.cjs");

// --- Pure classifier (unit-testable without git) -----------------------------
// Decide whether a shell command string should be BLOCKED because one of its
// segments is a `gh pr checkout` invocation.
//
// Returns { block: boolean, detail: string }.
//
// A command BLOCKS if ANY of its resolved segments is a `gh` invocation whose
// first two positional (non-flag) arguments are `pr` then `checkout` or `co`,
// OR whose first positional is the top-level `co` alias. GitHub CLI ships both
// aliases for `pr checkout`, so all three forms perform the identical branch
// creation + switch. Everything else — `gh pr diff`, `gh pr view`, `gh pr list`,
// `gh pr comment`, `gh issue …`,
// a bare `gh`, a non-gh command, or `echo gh pr checkout 1` (resolves to
// `echo`) — ALLOWS.
//
// Command resolution — "is this segment actually a `gh` invocation?" — is
// delegated to lib/resolve-command.cjs (PP-6t3c), the same primitive the merge
// and branch-switch guards use, so wrapper/quoting shapes (`eval "gh pr
// checkout 1"`, `env gh pr checkout 1`, `xargs -I{} gh pr checkout {}`) resolve
// correctly instead of sailing past a bespoke regex.
//
// gh's own value-consuming global flags (`-R`/`--repo <owner/repo>`,
// `--hostname <host>`) are skipped so `gh -R o/r pr checkout 1` still reads
// `pr checkout` as its positionals. The `=` forms (`--repo=o/r`) are
// self-contained and need no special handling. This set is kept in parity with
// `GH_VALUE_FLAGS` in block-direct-merge.cjs — the other gh guard — so a flag
// that shifts positionals past one guard cannot slip past the other (a divergent
// omission here was a real `gh --hostname h pr checkout 1` bypass, PP-p53z review).
function classifyCommand(command) {
  const { segments } = resolveCommand(String(command || ""));

  // gh global options that consume the NEXT token as their value.
  const optsWithSeparateArg = new Set(["-R", "--repo", "--hostname"]);

  for (const segment of segments) {
    if (segment.name !== "gh") continue;

    const tokens = segment.args;

    // Collect the first two positional (non-flag, non-flag-value) tokens.
    const positionals = [];
    for (let i = 0; i < tokens.length && positionals.length < 2; i++) {
      const t = tokens[i];
      if (t.startsWith("-")) {
        if (optsWithSeparateArg.has(t)) i++; // skip its value too
        continue;
      }
      positionals.push(t);
    }

    const isPrCheckout =
      positionals[0] === "pr" &&
      (positionals[1] === "checkout" || positionals[1] === "co");
    const isTopLevelCheckoutAlias = positionals[0] === "co";
    if (isPrCheckout || isTopLevelCheckoutAlias) {
      return {
        block: true,
        detail: isTopLevelCheckoutAlias ? "gh co" : `gh pr ${positionals[1]}`,
      };
    }
  }

  return { block: false, detail: "" };
}

module.exports = { classifyCommand };

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

    // Cheap pre-filter: no checkout command/alias anywhere after `gh` → allow
    // without parsing. It must admit both `gh pr co` and the top-level `gh co`
    // alias so the classifier gets the final say. Over-matching is harmless.
    if (!/\bgh\b[\s\S]*\b(?:checkout|co)\b/.test(cmd)) {
      process.exit(0);
    }

    const { block, detail } = classifyCommand(cmd);
    if (!block) {
      process.exit(0);
    }

    console.error(
      `Blocked: ${detail}. It creates a local branch (usually \`prNNNN\`) and ` +
        `switches this checkout onto it — inside a session worktree that strands ` +
        `the lead agent's subsequent commits on a throwaway branch (PP-p53z). ` +
        `To INSPECT a PR use the read-only \`gh pr diff <n>\` or \`gh pr view <n>\`. ` +
        `To WORK on a PR's branch, fetch it into a dedicated worktree: ` +
        `\`git fetch origin <branch> && git worktree add <path> <branch>\`.`
    );
    process.exit(2);
  });
}
