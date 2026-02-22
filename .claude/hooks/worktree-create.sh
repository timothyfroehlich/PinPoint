#!/bin/bash
# Claude Code WorktreeCreate hook
# Receives JSON on stdin: {"name": "slug-name", ...}
# Must print absolute worktree path to stdout
set -euo pipefail

INPUT=$(cat)
NAME=$(echo "$INPUT" | jq -r '.name')

# Use the name as a branch: worktree/<name>
BRANCH="worktree/${NAME}"

# Find pinpoint-wt.py relative to this script (hooks/ -> .claude/ -> repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Create worktree — JSON mode sends human output to stderr, path info to stdout
# stderr passes through so Claude Code can surface diagnostic messages on failure
if ! RESULT=$(python3 "${SCRIPT_DIR}/pinpoint-wt.py" create "${BRANCH}" --json); then
  echo "Error: pinpoint-wt.py failed to create worktree for branch '${BRANCH}'" >&2
  exit 1
fi

if ! PATH_VALUE=$(echo "$RESULT" | jq -er '.path'); then
  echo "Error: could not parse worktree path from pinpoint-wt.py output" >&2
  exit 1
fi

echo "$PATH_VALUE"
