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
    // Match `gh pr merge` (with optional flags), but not `gh pr merge --help` (rare).
    if (/\bgh\s+pr\s+merge\b/.test(cmd) && !/--help\b/.test(cmd)) {
      isMergeAttempt = true;
      detail = "gh pr merge";
    }
    // Match raw API merge: `gh api -X PUT .../pulls/N/merge` or `curl .../merge`
    if (/\bgh\s+api\s+.*-X\s+(PUT|POST)\b.*\/pulls\/\d+\/merge\b/.test(cmd)) {
      isMergeAttempt = true;
      detail = "gh api PUT .../merge";
    }
  } else if (tool === "mcp__plugin_github_github__merge_pull_request") {
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
