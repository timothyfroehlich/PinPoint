#!/bin/bash
# Claude Code hook: TaskCompleted
# Prevents agents from marking tasks done when quality gates fail.
#
# Exit codes:
#   0 = allow (quality gates passed)
#   2 = block (quality gates failed, agent must fix before completing)
#
# Reads the agent's cwd from stdin JSON so it runs checks in the RIGHT repo
# (learned from Ralph Loops 2026-02-20).
#
# CONTRACT MODE: If .claude-task-contract exists in the worktree root,
# all checklist items must be checked off before task completion is allowed.
#
# SAFEWORD: If the agent is truly stuck, it can run:
#   touch .claude-hook-bypass

# Ensure jq is available (hooks fail closed without it)
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required by definition-of-done.sh but is not installed." >&2
  exit 2
fi

INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // "unknown"')
AGENT_CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TEAMMATE_NAME=$(echo "$INPUT" | jq -r '.teammate_name // empty')

if [ -n "$AGENT_CWD" ] && [ -d "$AGENT_CWD" ]; then
  if ! cd "$AGENT_CWD"; then
    echo "🔁 Ralph says: Failed to cd into '$AGENT_CWD'. Cannot run quality checks." >&2
    exit 2
  fi
fi

# Safeword — agent is stuck and wants out (persistent until manual cleanup)
if [ -f ".claude-hook-bypass" ]; then
  exit 0
fi

# Smart teammate detection: if this is a teammate and the CWD is NOT a
# worktree, then .cwd points to the lead's repo — contract checks, pnpm run
# check, etc. would all run against the wrong codebase. Skip entirely.
# Only `isolation: "worktree"` sets the correct CWD for teammates.
if [ -n "$TEAMMATE_NAME" ]; then
  GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
  GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
  if [ "$GIT_DIR" = "$GIT_COMMON_DIR" ]; then
    # CWD is the main repo, not a worktree — skip all checks
    exit 0
  fi
fi

# Contract mode: find contract at worktree root (handles subdirectory cwd)
WORKTREE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
CONTRACT_FILE="$WORKTREE_ROOT/.claude-task-contract"

if [ -f "$CONTRACT_FILE" ]; then
  unchecked=$(grep -c '^\- \[ \]' "$CONTRACT_FILE")
  grep_exit=$?
  # grep returns 0=matches found, 1=no matches (all checked — success), 2+=error
  if [ "$grep_exit" -ge 2 ]; then
    echo "🔁 Ralph says: Failed to read contract file '$CONTRACT_FILE'." >&2
    exit 2
  fi
  if [ "$unchecked" -gt 0 ]; then
    echo "🔁 Ralph says: Task contract has $unchecked unchecked item(s) for '$TASK_SUBJECT':" >&2
    grep '^\- \[ \]' "$CONTRACT_FILE" | sed 's/^/  /' >&2
    echo "Check off all items in $CONTRACT_FILE before completing. — or if stuck: touch $WORKTREE_ROOT/.claude-hook-bypass" >&2
    exit 2
  fi
fi

if ! pnpm run check >&2; then
  echo "🔁 Ralph says: Quality gates failed for '$TASK_SUBJECT'. Fix issues before completing. — or if stuck: touch $WORKTREE_ROOT/.claude-hook-bypass" >&2
  exit 2
fi

exit 0
