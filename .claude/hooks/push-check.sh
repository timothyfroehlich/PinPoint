#!/bin/bash
# Claude Code hook: TeammateIdle
# Prevents teammates from going idle with unpushed commits.
#
# Exit codes:
#   0 = allow (nothing to push)
#   2 = block (unpushed work detected, agent must push first)
#
# Reads the teammate's cwd from stdin JSON so it checks the RIGHT repo,
# not the lead agent's main repo (which caused Ralph Loops 2026-02-20).
#
# SAFEWORD: If the agent is truly stuck, it can run:
#   touch .claude-hook-bypass

# Ensure jq is available (hooks fail closed without it)
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required by push-check.sh but is not installed." >&2
  exit 2
fi

INPUT=$(cat)
AGENT_CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TEAMMATE_NAME=$(echo "$INPUT" | jq -r '.teammate_name // empty')

if [ -z "$AGENT_CWD" ] || [ ! -d "$AGENT_CWD" ]; then
  exit 0
fi

cd "$AGENT_CWD" || exit 0

# Safeword — agent is stuck and wants out (persistent until manual cleanup)
if [ -f ".claude-hook-bypass" ]; then
  exit 0
fi

# Smart teammate detection: if this is a teammate and the CWD is NOT a
# worktree, then .cwd points to the lead's repo — we can't reliably check
# push state. Only `isolation: "worktree"` sets the correct CWD for teammates.
if [ -n "$TEAMMATE_NAME" ]; then
  GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
  GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
  if [ "$GIT_DIR" = "$GIT_COMMON_DIR" ]; then
    # CWD is the main repo, not a worktree — skip check
    exit 0
  fi
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  exit 0
fi

UPSTREAM=$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null)
if [ -z "$UPSTREAM" ]; then
  COMMITS=$(git log --oneline -1 2>/dev/null)
  if [ -n "$COMMITS" ]; then
    echo "🔁 Ralph says: Branch '$BRANCH' has no upstream. Run: git push -u origin $BRANCH — or if stuck: touch $AGENT_CWD/.claude-hook-bypass" >&2
    exit 2
  fi
  exit 0
fi

AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null) || AHEAD=""
if [ -z "$AHEAD" ]; then
  echo "🔁 Ralph says: Could not determine unpushed commit count for '$BRANCH'. Verify git state manually. — or if stuck: touch $AGENT_CWD/.claude-hook-bypass" >&2
  exit 2
fi
if [ "$AHEAD" -gt 0 ]; then
  echo "🔁 Ralph says: Branch '$BRANCH' has $AHEAD unpushed commit(s). Run: git push — or if stuck: touch $AGENT_CWD/.claude-hook-bypass" >&2
  exit 2
fi

# Note: checks staged + unstaged tracked file changes vs HEAD; does not catch untracked files
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "🔁 Ralph says: Uncommitted changes detected. Commit and push. — or if stuck: touch $AGENT_CWD/.claude-hook-bypass" >&2
  exit 2
fi

exit 0
