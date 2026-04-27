#!/usr/bin/env node
/**
 * PreToolUse hook: block known bad shell patterns and redirect to proper tools.
 *
 * Rules:
 * 1. Manual CI polling loops → use ./scripts/workflow/pr-watch.py
 * 2. Ad-hoc curl health checks → use `pnpm run dev:status`
 *
 * Note: `gh pr merge` is gated by the "ask" tier in settings.json, not by this
 * hook. That keeps the confirmation interactive (and overridable) instead of a
 * hard deny that can't be authorized in-conversation.
 */

const rules = [
  {
    name: "manual-ci-polling",
    test: (cmd) => {
      const hasLoop =
        /\b(for|while)\b/.test(cmd) && /\bsleep\b/.test(cmd);
      const hasGhWatch = /gh (pr checks|run watch)\b/.test(cmd);
      return hasLoop && hasGhWatch;
    },
    reason:
      "Manual CI polling loop detected. Use ./scripts/workflow/pr-watch.py <PR_NUMBER> instead, or invoke the pinpoint-github-monitor skill.",
  },
  {
    name: "curl-health-check",
    test: (cmd) => {
      const hasCurl = /\bcurl\b/.test(cmd);
      const hitsLocalhost = /localhost[:\s]|127\.0\.0\.1/.test(cmd);
      const looksLikeHealthCheck =
        /http_code|\/health|\/auth\/v1/.test(cmd) ||
        (/\bcurl\b.*-[a-zA-Z]*[sf]/.test(cmd) && hitsLocalhost);
      return hasCurl && hitsLocalhost && looksLikeHealthCheck;
    },
    reason:
      "Ad-hoc curl health check detected. Use `pnpm run dev:status` instead — it checks Next.js, Supabase, and Postgres in one command and respects worktree port config.",
  },
];

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

  for (const rule of rules) {
    if (rule.test(command)) {
      const decision = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: rule.reason,
        },
      };
      process.stdout.write(JSON.stringify(decision));
      process.exit(0);
    }
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
