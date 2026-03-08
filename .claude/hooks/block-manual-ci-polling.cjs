#!/usr/bin/env node
/**
 * PreToolUse hook: block manual sleep/poll loops that watch GitHub CI.
 *
 * Agents should use ./scripts/workflow/monitor-gh-actions.sh <PR> instead
 * of writing ad-hoc `for i in ...; do sleep N; gh pr checks ...; done` loops.
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

  const hasLoop =
    /\b(for|while)\b/.test(command) && /\bsleep\b/.test(command);
  const hasGhWatch =
    /gh (pr checks|run view|run watch)\b/.test(command);

  if (hasLoop && hasGhWatch) {
    const decision = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Manual CI polling loop detected. Use ./scripts/workflow/monitor-gh-actions.sh <PR_NUMBER> instead, or invoke the pinpoint-github-monitor skill.",
      },
    };
    process.stdout.write(JSON.stringify(decision));
    process.exit(0);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
