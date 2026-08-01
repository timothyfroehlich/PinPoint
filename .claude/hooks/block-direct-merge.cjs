#!/usr/bin/env node
// .claude/hooks/block-direct-merge.cjs
// PreToolUse hook: blocks ALL agent-initiated PR merges. There is no agent-usable
// bypass — merging is human-only (PP-wi85). The only merge channel left is a human
// typing a `!`-prefixed command in Claude Code, which does not generate a
// PreToolUse event and so is never seen by this hook.
//
// Blocks four shapes:
//   1. `gh pr merge` (direct CLI merge)
//   2. `gh api .../pulls/N/merge` with a write method (REST merge)
//   3. `scripts/workflow/merge-pr.sh` (the gate-enforced merge script itself —
//      gate-enforcement is not a substitute for human sign-off)
//   4. mcp__github__merge_pull_request (MCP merge)
//
// HOW IT MATCHES (PP-6t3c, PP-ar8a). This used to regex a quote-stripped copy of
// the command, which had the boundary wide open: `eval "gh pr merge 123"`,
// `sh -c "…merge-pr.sh…"`, `env gh pr merge`, `time gh pr merge` and
// `xargs -I{} gh pr merge {}` all ALLOWED on main, because the quote-stripping
// erased the payload and the wrapper list was hardcoded and short. It now
// resolves the effective command of every shell segment via
// lib/resolve-command.cjs and matches on that.
//
// POSTURE ON `unresolvable`: this is a hard boundary, so an unknowable command
// is treated as suspicious, not safe. When the resolver cannot statically know
// what runs (`eval "$CMD"`, `sh -c "$X"`, `$(pick) pr merge`), the raw command
// text is scanned for merge indicators and a hit BLOCKS. A resolvable command
// never reaches that scan, so prose — `echo "run merge-pr.sh"`, `rg` over docs,
// `bd comments add "… merge-pr.sh …"` — still passes.

const { resolveCommand } = require("./lib/resolve-command.cjs");

// Raw-text indicators, used ONLY on the unresolvable path. Deliberately looser
// than the resolved matchers — `$(pick) pr merge 1` and `eval "$CMD"` (with the
// merge text elsewhere in the command) have no `gh` token adjacent to the
// subcommand. Prose never reaches here: a resolvable command returns before the
// scan, and only a dynamic COMMAND SLOT, a dynamic `eval`/`sh -c` payload, or
// an unbalanced quote makes a command unresolvable.
const RAW_MERGE_INDICATORS = [
  { pattern: /\bpr\s+merge\b/, kind: "merge", detail: "gh pr merge" },
  {
    pattern: /\/pulls\/\d+\/merge\b/,
    kind: "merge",
    detail: "gh api PUT .../merge",
  },
  {
    pattern: /\bmerge-pr\.sh\b/,
    kind: "merge-script",
    detail: "scripts/workflow/merge-pr.sh",
  },
];

const HELP_FLAGS = new Set(["--help", "-h"]);
const WRITE_METHODS = new Set(["PUT", "POST"]);
const MERGE_API_PATH = /\/pulls\/\d+\/merge\b/;

// gh flags that consume the NEXT token as their value. Skipping their values
// keeps a repo selector from splitting the subcommand chain: `gh pr --repo o/r
// merge 1` must read as `pr merge`, not `pr`, `o/r`, `merge`.
const GH_VALUE_FLAGS = new Set(["-R", "--repo", "--hostname"]);

/** gh's positional arguments — flag values removed, so the subcommand chain is
 *  contiguous. Flags with `=` carry their value inline and need no skipping. */
function ghPositionals(args) {
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) {
      if (GH_VALUE_FLAGS.has(a)) i++;
      continue;
    }
    positionals.push(a);
  }
  return positionals;
}

/** Does `args` invoke `gh api` against a pulls/N/merge path with a write method? */
function isGhApiMerge(args) {
  if (!args.some((a) => MERGE_API_PATH.test(a))) return false;
  let hasWriteMethod = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-X" || a === "--method") {
      if (WRITE_METHODS.has(String(args[i + 1] || "").toUpperCase())) {
        hasWriteMethod = true;
      }
      continue;
    }
    const eq = /^(?:-X|--method)=(.+)$/.exec(a);
    if (eq && WRITE_METHODS.has(eq[1].toUpperCase())) hasWriteMethod = true;
  }
  if (!hasWriteMethod) return false;
  // `api` must be gh's subcommand, not a value of some flag.
  return ghPositionals(args).includes("api");
}

/** Does `args` invoke `gh pr merge`? Adjacency in the positional chain, so
 *  `gh -R o/r pr merge` matches while `gh pr list --search "pr merge"` — where
 *  the search string is ONE quoted token — does not. */
function isGhPrMerge(args) {
  const positionals = ghPositionals(args);
  return positionals.some(
    (a, i) => a === "pr" && positionals[i + 1] === "merge"
  );
}

/**
 * Pure classifier. Returns { block, kind, detail }.
 *   kind: "merge" | "merge-script" | null
 * Exported so verify-guard-stack.cjs can probe that this guard still BLOCKS a
 * known-bad command, not merely that it is still registered.
 */
function classifyMerge(toolName, command) {
  if (toolName === "mcp__github__merge_pull_request") {
    return { block: true, kind: "merge", detail: "MCP merge_pull_request" };
  }
  if (toolName !== "Bash") return { block: false, kind: null, detail: "" };

  const cmd = String(command || "");
  const { segments, unresolvable } = resolveCommand(cmd);

  for (const segment of segments) {
    if (segment.name === "merge-pr.sh") {
      return {
        block: true,
        kind: "merge-script",
        detail: "scripts/workflow/merge-pr.sh",
      };
    }
    if (segment.name !== "gh") continue;
    // `gh pr merge --help` / `gh api --help` document rather than merge.
    if (segment.args.some((a) => HELP_FLAGS.has(a))) continue;
    if (isGhPrMerge(segment.args)) {
      return { block: true, kind: "merge", detail: "gh pr merge" };
    }
    if (isGhApiMerge(segment.args)) {
      return { block: true, kind: "merge", detail: "gh api PUT .../merge" };
    }
  }

  if (unresolvable.length > 0) {
    for (const { pattern, kind, detail } of RAW_MERGE_INDICATORS) {
      if (pattern.test(cmd)) {
        return { block: true, kind, detail: `${detail} (inside an unresolvable command)` };
      }
    }
  }

  return { block: false, kind: null, detail: "" };
}

module.exports = { classifyMerge };

// --- Hook entrypoint ----------------------------------------------------------
// Only run as a hook when invoked directly (not when require()'d by a test or by
// the guard-stack canary).
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

    const { block, kind, detail } = classifyMerge(
      payload.tool_name || "",
      (payload.tool_input || {}).command
    );

    if (!block) {
      process.exit(0);
    }

    // No bypass sentinel — merging has no agent-usable escape hatch under the
    // hard gate (PP-wi85). If merge-pr.sh itself is broken and a hotfix must
    // ship, that is a human decision made in a human-run shell, not a hook bypass.
    if (kind === "merge-script") {
      console.error(
        "Merge is human-only. You cannot run merge-pr.sh. Finish the PR (CI green, reviews " +
          "resolved, screenshots posted if UI), then hand Tim the exact command to run himself: " +
          `! scripts/workflow/merge-pr.sh <PR> --human [matched: ${detail}]`
      );
      process.exit(2);
    }

    console.error(
      `Direct merge blocked: ${detail}. Merging is human-only — hand Tim the exact command to ` +
        "run himself: ! scripts/workflow/merge-pr.sh <PR> --human"
    );
    process.exit(2);
  });
}
