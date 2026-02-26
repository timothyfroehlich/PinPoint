#!/bin/bash
# Claude Code WorktreeRemove hook
# Receives JSON on stdin: {"worktree_path": "/absolute/path", ...}
set -euo pipefail

INPUT=$(cat)
WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path')

if [ -z "$WORKTREE_PATH" ] || [ "$WORKTREE_PATH" = "null" ]; then
  echo "Warning: Missing or null worktree_path in hook input; skipping worktree-remove hook." >&2
  exit 0
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "Warning: Worktree path '$WORKTREE_PATH' does not exist; skipping worktree-remove hook." >&2
  exit 0
fi

# Extract branch name from worktree
BRANCH=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [ -z "$BRANCH" ]; then
  echo "Warning: Could not determine branch for $WORKTREE_PATH" >&2
  exit 0
fi

# Find pinpoint-wt.py relative to this script (hooks/ -> .claude/ -> repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Removal failures are non-fatal (worktree may already be gone); log a warning on failure
if ! python3 "${SCRIPT_DIR}/pinpoint-wt.py" remove "${BRANCH}" --json >/dev/null; then
  echo "Warning: Failed to remove pinpoint worktree for branch ${BRANCH}" >&2
fi
