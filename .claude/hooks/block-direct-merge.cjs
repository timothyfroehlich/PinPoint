#!/usr/bin/env node
// .claude/hooks/block-direct-merge.cjs
// PreToolUse hook: blocks direct PR merge calls.
// Bypass: presence of .claude-merge-bypass file in repo root (single-use, deleted on fire).

const fs = require("node:fs");
const path = require("node:path");

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
  let detail = "";

  if (tool === "Bash") {
    const cmd = String(toolInput.command || "");
    // Strip quoted strings so `echo "gh pr merge"` / `rg "gh pr merge"` / doc heredocs
    // mentioning the command don't trip the guard. Basic stripper — does not handle
    // nested quoting perfectly, but covers the common false-positive class.
    const stripped = cmd
      .replace(/'[^']*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
    // Match `gh pr merge` only when it's an actual command (start of line or right
    // after a control operator), not buried inside arguments or substrings.
    const ghMerge = /(?:^|;|&&|\|\||\||&|\n|\$\(|<\(|\(|`)\s*gh\s+pr\s+merge\b/;
    if (ghMerge.test(stripped) && !/--help\b/.test(stripped)) {
      isMergeAttempt = true;
      detail = "gh pr merge";
    }
    // Match raw API merge: requires (1) `gh api` at a command-start position,
    // (2) a /pulls/N/merge path, and (3) a write method via `-X` or `--method`.
    // Patterns AND together so flag order doesn't matter — `gh api repos/X/Y/pulls/1/merge -X PUT`
    // is just as caught as `gh api -X PUT repos/X/Y/pulls/1/merge`.
    const ghApiStart = /(?:^|;|&&|\|\||\||&|\n|\$\(|<\(|\(|`)\s*gh\s+api\b/;
    const mergePath = /\/pulls\/\d+\/merge\b/;
    const writeMethod = /(?:-X|--method)[\s=]+(?:PUT|POST)\b/;
    if (ghApiStart.test(stripped) && mergePath.test(stripped) && writeMethod.test(stripped)) {
      isMergeAttempt = true;
      detail = "gh api PUT .../merge";
    }
  } else if (tool === "mcp__github__merge_pull_request") {
    isMergeAttempt = true;
    detail = "MCP merge_pull_request";
  }

  if (!isMergeAttempt) {
    process.exit(0);
  }

  // Check for bypass sentinel.
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sentinel = path.join(cwd, ".claude-merge-bypass");
  if (fs.existsSync(sentinel)) {
    // Allow this merge; consume the sentinel.
    try {
      fs.unlinkSync(sentinel);
    } catch {}
    process.exit(0);
  }

  // Block.
  console.error(
    `Direct merge blocked: ${detail}. Use scripts/workflow/merge-pr.sh <PR> to enforce gate re-checks. ` +
      `Override with: touch .claude-merge-bypass (single-use sentinel, auto-deleted on hook fire).`
  );
  process.exit(2);
});
