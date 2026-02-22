#!/bin/bash
# Claude Code WorktreeRemove hook
# Receives JSON on stdin: {"worktree_path": "/absolute/path", ...}
set -euo pipefail

INPUT=$(cat)
WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path')

# Extract branch name from worktree
BRANCH=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [ -z "$BRANCH" ]; then
  echo "Warning: Could not determine branch for $WORKTREE_PATH" >&2
  exit 0
fi

# Find pinpoint-wt.py relative to this script (hooks/ -> .claude/ -> repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

python3 "${SCRIPT_DIR}/pinpoint-wt.py" remove "${BRANCH}" --json >/dev/null 2>&1 || true
