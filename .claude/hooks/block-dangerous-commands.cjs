#!/usr/bin/env node
/**
 * PreToolUse hook: Block permission-changing and other dangerous commands.
 *
 * Returns a JSON deny decision with a clear reason message so the agent
 * understands WHY the command was blocked and can adjust its approach.
 *
 * Blocked commands:
 * - chmod, chown, chgrp (permission changes — prompt injection risk)
 * - git update-index --chmod (git-level permission change)
 */

async function main() {
  let inputData = "";
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  if (!inputData.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(inputData);
  } catch {
    process.exit(0);
  }

  const command = input.tool_input?.command;
  if (!command) {
    process.exit(0);
  }

  // Strip heredoc content before checking patterns.
  // Heredocs (<<'EOF' ... EOF) contain user text like commit messages
  // that shouldn't trigger command-level blocks.
  const stripped = command.replace(/<<'?(\w+)'?[\s\S]*?\n\1/g, "");

  const patterns = [
    {
      regex: /(?:^|&&|;|\|)\s*(?:sudo\s+)?chmod\b/,
      reason:
        "Blocked: chmod. Ask Tim to run the command himself.",
    },
    {
      regex: /(?:^|&&|;|\|)\s*(?:sudo\s+)?chown\b/,
      reason:
        "Blocked: chown. Ask Tim to run the command himself.",
    },
    {
      regex: /(?:^|&&|;|\|)\s*(?:sudo\s+)?chgrp\b/,
      reason:
        "Blocked: chgrp. Ask Tim to run the command himself.",
    },
    {
      regex: /git\s+update-index\s+--chmod/,
      reason:
        "Blocked: git update-index --chmod. Ask Tim to run the command himself.",
    },
  ];

  for (const { regex, reason } of patterns) {
    if (regex.test(stripped)) {
      // Output JSON deny decision — agent sees the reason
      const decision = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      };
      process.stdout.write(JSON.stringify(decision));
      process.exit(0);
    }
  }

  // Allow all other commands
  process.exit(0);
}

main().catch(() => process.exit(0));
