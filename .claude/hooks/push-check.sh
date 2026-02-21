#!/bin/bash
# Claude Code hook: TeammateIdle
# Prevents teammates from going idle with unpushed commits.
#
# Exit codes:
#   0 = allow (nothing to push)
#   2 = block (unpushed work detected, agent must push first)
#
# Reads the teammate's cwd from stdin JSON so it checks the RIGHT repo,
# not the lead agent's main repo (which caused Ralph Loops 2026-02-21).
#
# SAFEWORD: If the agent is truly stuck, it can run:
#   touch .claude-hook-bypass

INPUT=$(cat)
AGENT_CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$AGENT_CWD" ] || [ ! -d "$AGENT_CWD" ]; then
  exit 0
fi

cd "$AGENT_CWD" || exit 0

# Safeword — agent is stuck and wants out
if [ -f ".claude-hook-bypass" ]; then
  rm -f ".claude-hook-bypass"
  exit 0
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

AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null)
if [ "$AHEAD" -gt 0 ]; then
  echo "🔁 Ralph says: Branch '$BRANCH' has $AHEAD unpushed commit(s). Run: git push — or if stuck: touch $AGENT_CWD/.claude-hook-bypass" >&2
  exit 2
fi

if ! git diff --quiet HEAD 2>/dev/null; then
  echo "🔁 Ralph says: Uncommitted changes detected. Commit and push. — or if stuck: touch $AGENT_CWD/.claude-hook-bypass" >&2
  exit 2
fi

exit 0
