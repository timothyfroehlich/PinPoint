#!/bin/bash
# worktree-create.sh — WorktreeCreate hook with flock serialization + retry/backoff
#
# Context (PP-bg45, PP-46z): Concurrent Claude sessions sharing one repo clone race on
# .git/config.lock when both call `git worktree add` simultaneously. This applies both
# within a single session (N≥3 parallel Agent(isolation:worktree) calls per
# anthropics/claude-code#47266) and cross-session (Slingshot's 2026-05-16 16:34/16:46
# CDT repro: plain `git checkout -b` + push from one session corrupted another session's
# HEAD; PP-cvh thread 2026-05-16 21:47-21:48).
#
# Fix: wrap `git worktree add` with:
#   1. lockf(1) on ~/.config/pinpoint/worktree-add.lock — kernel-level flock(2) exclusive
#      lock, serializes ALL `git worktree add` operations across every Claude session on
#      this host (not just within-session).
#   2. Retry + exponential backoff (5 retries, base 200ms) to absorb transient
#      .git/config.lock contention from non-Claude git processes.
#
# Platform: macOS. Uses /usr/bin/lockf (ships with macOS, backed by flock(2)).
#   On Linux, replace `lockf -k` with `flock --no-fork -x` from util-linux.
#
# Registration: .claude/settings.json hooks.WorktreeCreate runs this via
#   `bash .claude/hooks/worktree-create.sh "$@"` (no executable bit required).
#
# TODO (Tim): If you ever want to invoke this script directly (not via the hook),
#   run: chmod +x .claude/hooks/worktree-create.sh
#   That chmod is auto-denied to subagents per CLAUDE.md.

set -euo pipefail

# --- Parse Claude Code WorktreeCreate hook JSON from stdin ---
INPUT=$(cat)

BASE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('base_path',''))")
BRANCH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('branch',''))")
ISOLATION_ID=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isolation_id',''))")

if [ -z "$BASE_PATH" ] || [ -z "$BRANCH" ]; then
  echo "worktree-create.sh: missing base_path or branch in hook input" >&2
  exit 1
fi

WORKTREE_PATH="${BASE_PATH}/.claude/worktrees/${ISOLATION_ID:-$BRANCH}"

# --- Lock file: ~/.config/pinpoint/worktree-add.lock ---
# Shared across all Claude sessions on this host (kernel-level, not advisory-only).
LOCK_DIR="$HOME/.config/pinpoint"
LOCK_FILE="$LOCK_DIR/worktree-add.lock"
mkdir -p "$LOCK_DIR"

# lockf flags used:
#   -k  keep the lock file after release (recommended for concurrency per lockf(1) man page;
#       prevents delete/recreate races, guarantees lock ordering)
#   -t 30  wait up to 30 seconds for the lock before giving up
#
# lockf wraps the inner do_worktree_add function, serializing it across sessions.
do_worktree_add() {
  local max_retries=5
  local delay_ms=200
  local attempt

  for attempt in $(seq 1 "$max_retries"); do
    if git -C "$BASE_PATH" worktree add "$WORKTREE_PATH" -b "$BRANCH" 2>/dev/null; then
      echo "$WORKTREE_PATH"
      return 0
    fi

    if [ "$attempt" -lt "$max_retries" ]; then
      # Exponential backoff: 200ms, 400ms, 800ms, 1600ms ...
      local sleep_sec
      sleep_sec=$(echo "scale=3; $delay_ms / 1000" | bc)
      echo "worktree-create.sh: attempt $attempt failed, retrying in ${delay_ms}ms..." >&2
      sleep "$sleep_sec"
      delay_ms=$((delay_ms * 2))
    fi
  done

  echo "worktree-create.sh: FAILED to create worktree after $max_retries attempts" >&2
  echo "  base_path=$BASE_PATH  branch=$BRANCH  target=$WORKTREE_PATH" >&2
  return 1
}

export -f do_worktree_add
export BASE_PATH BRANCH WORKTREE_PATH

# lockf -k: keep lock file (recommended); -t 30: wait up to 30s for the exclusive lock.
# The subshell ensures do_worktree_add runs inside the lock.
lockf -k -t 30 "$LOCK_FILE" bash -c 'do_worktree_add'
