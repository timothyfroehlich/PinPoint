#!/usr/bin/env bash
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
RESULT=$(python3 "${SCRIPT_DIR}/pinpoint-wt.py" create "${BRANCH}" --json 2>/dev/null)
PATH_VALUE=$(echo "$RESULT" | jq -r '.path')

echo "$PATH_VALUE"
