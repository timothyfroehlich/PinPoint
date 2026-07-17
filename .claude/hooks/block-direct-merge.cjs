#!/usr/bin/env node
// .claude/hooks/block-direct-merge.cjs
// PreToolUse hook: blocks ALL agent-initiated PR merges. There is no agent-usable
// bypass — merging is human-only (PP-wi85). The only merge channel left is a human
// typing a `!`-prefixed command in Claude Code, which does not generate a
// PreToolUse event and so is never seen by this hook.
//
// Blocks three shapes:
//   1. `gh pr merge` (direct CLI merge)
//   2. `gh api .../pulls/N/merge` with a write method (REST merge)
//   3. `scripts/workflow/merge-pr.sh` (the gate-enforced merge script itself —
//      gate-enforcement is not a substitute for human sign-off)
//   4. mcp__github__merge_pull_request (MCP merge)

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

  const tool = payload.tool_name || "";
  const toolInput = payload.tool_input || {};

  let isMergeAttempt = false;
  let isMergeScriptAttempt = false;
  let detail = "";

  if (tool === "Bash") {
    const cmd = String(toolInput.command || "");
    // Strip quoted content so mentions in `echo`/`rg`/docs/heredocs don't false-positive.
    const stripped = cmd
      .replace(/'[^']*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
    const cmdStart = /(?:^|;|&&|\|\||\||&|\n|\$\(|<\(|\(|`)\s*/;

    // Prefix gate: skip gh-related regex work when nothing gh-related is present, and
    // pass any --help invocation symmetrically (`gh pr merge --help`, `gh api --help`).
    if (cmd.includes("gh") && !/--help\b/.test(cmd)) {
      const ghMerge = new RegExp(cmdStart.source + "gh\\s+pr\\s+merge\\b");
      if (ghMerge.test(stripped)) {
        isMergeAttempt = true;
        detail = "gh pr merge";
      }
      // gh api ... /pulls/N/merge — AND three patterns so flag order doesn't matter.
      // mergePath is the cheapest discriminator — test first to short-circuit.
      const mergePath = /\/pulls\/\d+\/merge\b/;
      const writeMethod = /(?:-X|--method)[\s=]+(?:PUT|POST)\b/;
      const ghApiStart = new RegExp(cmdStart.source + "gh\\s+api\\b");
      if (mergePath.test(stripped) && writeMethod.test(stripped) && ghApiStart.test(stripped)) {
        isMergeAttempt = true;
        detail = "gh api PUT .../merge";
      }
    }

    // scripts/workflow/merge-pr.sh — detect at a command-start position, tolerating
    // `bash`/`sh` wrappers, leading `VAR=val` assignments (bare or after `env`),
    // and a relative/absolute path prefix ahead of the basename. Quote-stripped
    // `stripped` reuses the same false-positive protection as the gh checks above
    // (docs/echo mentions don't match).
    const mergeScript = new RegExp(
      cmdStart.source +
        "(?:env\\s+)?" + // optional `env` wrapper
        "(?:[A-Za-z_][A-Za-z0-9_]*=\\S+\\s+)*" + // optional leading VAR=val assignments (bare or after env)
        "(?:(?:bash|sh)\\s+)?" + // optional interpreter wrapper
        "(?:\\S*/)?" + // optional path prefix (relative or absolute)
        "merge-pr\\.sh\\b"
    );
    if (mergeScript.test(stripped)) {
      isMergeScriptAttempt = true;
      detail = "scripts/workflow/merge-pr.sh";
    }
  } else if (tool === "mcp__github__merge_pull_request") {
    isMergeAttempt = true;
    detail = "MCP merge_pull_request";
  }

  if (isMergeScriptAttempt) {
    console.error(
      "Merge is human-only. You cannot run merge-pr.sh. Finish the PR (CI green, reviews " +
        "resolved, screenshots posted if UI), then hand Tim the exact command to run himself: " +
        "! scripts/workflow/merge-pr.sh <PR> --human"
    );
    process.exit(2);
  }

  if (!isMergeAttempt) {
    process.exit(0);
  }

  // Block. No bypass sentinel — merging has no agent-usable escape hatch under
  // the hard gate (PP-wi85). If merge-pr.sh itself is broken and a hotfix must
  // ship, that is a human decision made in a human-run shell, not a hook bypass.
  console.error(
    `Direct merge blocked: ${detail}. Merging is human-only — hand Tim the exact command to ` +
      "run himself: ! scripts/workflow/merge-pr.sh <PR> --human"
  );
  process.exit(2);
});
