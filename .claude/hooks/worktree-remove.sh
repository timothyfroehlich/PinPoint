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

# Flush bead state to DoltHub before tearing the worktree down.
# Runs from main worktree (where the embedded Dolt data lives).
# Non-blocking: cleanup proceeds even if the push fails.
#
# Server mode: no-op. There is no local embedded Dolt to flush — writes already
# landed on the shared `dolt sql-server`, and the DoltHub bridge replicates
# out of band. Mode is read tolerantly from <main>/.beads/metadata.json
# (missing/unparseable ⇒ embedded, today's behavior).
if command -v bd >/dev/null 2>&1; then
  DOLT_MODE="embedded"
  META="$MAIN_WT/.beads/metadata.json"
  if [ -f "$META" ] && command -v jq >/dev/null 2>&1; then
    DOLT_MODE=$(jq -r '.dolt_mode // "embedded"' "$META" 2>/dev/null || echo embedded)
  fi
  if [ "$DOLT_MODE" != "server" ]; then
    (cd "$MAIN_WT" && bd dolt push --quiet) >&2 \
      || echo "Warning: bd dolt push failed (non-fatal)" >&2
  fi
fi

if [ -f "$CLEANUP" ]; then
  python3 "$CLEANUP" "$WORKTREE_PATH" >&2 || echo "Warning: cleanup failed" >&2
fi
