#!/usr/bin/env node
// .claude/hooks/block-direct-merge.cjs
// PreToolUse hook: blocks agent-initiated PR merges (PP-wi85).
//
// Blocks four shapes:
//   1. `gh pr merge` (direct CLI merge)
//   2. `gh api .../pulls/N/merge` with a write method (REST merge)
//   3. `scripts/workflow/merge-pr.sh` (the gate-enforced merge script itself —
//      gate-enforcement is not a substitute for human sign-off)
//   4. mcp__github__merge_pull_request (MCP merge)
//
// ONE exception (PP-c0uy — the Dependabot carve-out): a `merge-pr.sh` invocation
// that carries `--dependabot` and none of `--human` / `--force` /
// `--bypass-merge-requirements` is allowed through. Nothing else changes; shapes
// 1, 2 and 4 stay blocked unconditionally, as does every other `merge-pr.sh` shape.
//
// HONEST STATEMENT OF WHAT THIS HOOK NOW GUARANTEES:
// This hook sees only the command string. It CANNOT verify that the PR number in
// that string is actually Dependabot-authored, that every commit on it is
// bot-authored, or that the diff stays inside the dependency-bump path allowlist.
// It is, for this one path, a coarse *shape* filter — nothing more. The
// authoritative check is inside merge-pr.sh itself, which re-derives all three
// preconditions from the GitHub API and hard-REFUSEs on any failure. Before
// PP-c0uy this hook was a complete boundary ("no agent merge, period"); it is not
// that anymore, and no amount of regex here can restore it. Treat merge-pr.sh's
// preconditions as the security boundary and this hook as defense-in-depth.
//
// The human channel is unchanged: a `!`-prefixed command in Claude Code does not
// generate a PreToolUse event and so is never seen by this hook.

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
      // Dependabot carve-out (PP-c0uy): permit exactly one shape — a SINGLE
      // merge-pr.sh invocation carrying --dependabot and none of the flags that
      // would widen it. Every check runs against `stripped`, so a flag mentioned
      // inside quotes doesn't count as present (fail-closed: a quoted
      // `"--dependabot"` reads as absent and stays blocked).
      //
      // The single-invocation requirement closes the compound-command seam:
      // `merge-pr.sh 1 --dependabot && merge-pr.sh 2 --human` would otherwise
      // present one allowed shape and smuggle a second call past the flag scan,
      // which is done globally over the whole command string rather than
      // per-segment.
      const mergeScriptGlobal = new RegExp(mergeScript.source, "g");
      const invocationCount = (stripped.match(mergeScriptGlobal) || []).length;
      const wideningFlag =
        /--human\b/.test(stripped) ||
        /--force\b/.test(stripped) ||
        /--bypass-merge-requirements\b/.test(stripped);
      const dependabotCarveOut =
        invocationCount === 1 &&
        /--dependabot\b/.test(stripped) &&
        !wideningFlag;

      if (!dependabotCarveOut) {
        isMergeScriptAttempt = true;
        detail = "scripts/workflow/merge-pr.sh";
      }
    }
  } else if (tool === "mcp__github__merge_pull_request") {
    isMergeAttempt = true;
    detail = "MCP merge_pull_request";
  }

  if (isMergeScriptAttempt) {
    console.error(
      "Merge is human-only. You cannot run merge-pr.sh. Finish the PR (CI green, reviews " +
        "resolved, screenshots posted if UI), then hand Tim the exact command to run himself: " +
        "! scripts/workflow/merge-pr.sh <PR> --human\n" +
        "(The only agent-usable shape is `merge-pr.sh <PR> --dependabot` on a Dependabot " +
        "dependency-bump PR, with no --human/--force/--bypass-merge-requirements.)"
    );
    process.exit(2);
  }

  if (!isMergeAttempt) {
    process.exit(0);
  }

  // Block. No bypass sentinel — `gh pr merge`, `gh api ... /merge` and the MCP merge
  // have no agent-usable escape hatch (PP-wi85); the Dependabot carve-out (PP-c0uy)
  // applies only to merge-pr.sh, which enforces its own preconditions. If merge-pr.sh
  // itself is broken and a hotfix must ship, that is a human decision made in a
  // human-run shell, not a hook bypass.
  console.error(
    `Direct merge blocked: ${detail}. Merging is human-only — hand Tim the exact command to ` +
      "run himself: ! scripts/workflow/merge-pr.sh <PR> --human"
  );
  process.exit(2);
});
