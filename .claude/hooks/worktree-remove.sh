#!/bin/bash
# Claude Code WorktreeRemove hook
# Receives JSON on stdin: {"worktree_path": "/absolute/path", ...}
# Cleans up Supabase, Docker volumes, manifest slot, and git worktree.
set -euo pipefail

INPUT=$(cat)
WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path')

if [ -z "$WORKTREE_PATH" ] || [ "$WORKTREE_PATH" = "null" ]; then
  echo "Warning: Missing or null worktree_path in hook input; skipping." >&2
  exit 0
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "Warning: Worktree path '$WORKTREE_PATH' does not exist; skipping." >&2
  exit 0
fi

# Find cleanup script in the main worktree
MAIN_WT=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
CLEANUP="$MAIN_WT/scripts/worktree_cleanup.py"

if [ -f "$CLEANUP" ]; then
  python3 "$CLEANUP" "$WORKTREE_PATH" >&2 || echo "Warning: cleanup failed" >&2
fi
