#!/bin/bash
# Claude Code hook: TaskCompleted
# Prevents agents from marking tasks done when quality gates fail.
#
# Exit codes:
#   0 = allow (quality gates passed)
#   2 = block (quality gates failed, agent must fix before completing)
#
# Reads the agent's cwd from stdin JSON so it runs checks in the RIGHT repo
# (learned from Ralph Loops 2026-02-21).
#
# SAFEWORD: If the agent is truly stuck, it can run:
#   touch .claude-hook-bypass

INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // "unknown"')
AGENT_CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -n "$AGENT_CWD" ] && [ -d "$AGENT_CWD" ]; then
  cd "$AGENT_CWD" || true
fi

# Safeword — agent is stuck and wants out
if [ -f ".claude-hook-bypass" ]; then
  rm -f ".claude-hook-bypass"
  exit 0
fi

if ! pnpm run check 2>&1; then
  echo "🔁 Ralph says: Quality gates failed for '$TASK_SUBJECT'. Fix issues before completing. — or if stuck: touch $(pwd)/.claude-hook-bypass" >&2
  exit 2
fi

exit 0
