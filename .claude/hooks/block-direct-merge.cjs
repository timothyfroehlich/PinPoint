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
    // Prefix gate: skip all regex work when nothing gh-related is present, and
    // pass any --help invocation symmetrically (`gh pr merge --help`, `gh api --help`).
    if (cmd.includes("gh") && !/--help\b/.test(cmd)) {
      // Strip quoted content so mentions in `echo`/`rg`/docs/heredocs don't false-positive.
      const stripped = cmd
        .replace(/'[^']*'/g, "''")
        .replace(/"(?:\\.|[^"\\])*"/g, '""');
      const cmdStart = /(?:^|;|&&|\|\||\||&|\n|\$\(|<\(|\(|`)\s*/;
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
