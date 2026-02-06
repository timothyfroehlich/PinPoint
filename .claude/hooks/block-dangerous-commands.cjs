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

  // Match dangerous commands at the start of a command or after && / ; / |
  // This catches: "chmod ...", "sudo chmod ...", "cd foo && chmod ..."
  const patterns = [
    {
      regex: /(?:^|&&|;|\|)\s*(?:sudo\s+)?chmod\b/,
      reason:
        "chmod is blocked by project policy to prevent prompt injection attacks. " +
        "If you need to set executable bits, ask Tim to run chmod manually. " +
        "For pinpoint-wt.py, it already has the executable bit set.",
    },
    {
      regex: /(?:^|&&|;|\|)\s*(?:sudo\s+)?chown\b/,
      reason:
        "chown is blocked by project policy to prevent prompt injection attacks. " +
        "File ownership changes must be done manually by the user.",
    },
    {
      regex: /(?:^|&&|;|\|)\s*(?:sudo\s+)?chgrp\b/,
      reason:
        "chgrp is blocked by project policy to prevent prompt injection attacks. " +
        "File group changes must be done manually by the user.",
    },
    {
      regex: /git\s+update-index\s+--chmod/,
      reason:
        "git update-index --chmod is blocked by project policy. " +
        "Executable bit changes in git must be done manually by the user.",
    },
  ];

  for (const { regex, reason } of patterns) {
    if (regex.test(command)) {
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
