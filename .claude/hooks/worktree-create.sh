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
#   1. Exclusive file lock on ~/.config/pinpoint/worktree-add.lock — kernel-level flock(2)
#      lock, serializes ALL `git worktree add` operations across every Claude session on
#      this host (not just within-session). Uses lockf(1) on macOS or flock(1) on Linux.
#   2. Retry + exponential backoff (5 retries, base 200ms) to absorb transient
#      .git/config.lock contention from non-Claude git processes.
#      Only lock-contention errors trigger a retry; permanent errors (e.g. "branch already
#      exists", "path already exists") abort immediately with the error output.
#
# Invocation: Claude Code calls this hook as a WorktreeCreate hook. The hook contract is
#   JSON via stdin (not positional args). Registration in .claude/settings.json:
#     "command": "bash \"${CLAUDE_PROJECT_DIR:-.}\"/.claude/hooks/worktree-create.sh"
#   No positional args are passed; all input comes from the JSON payload on stdin.
#
# Platform: macOS uses /usr/bin/lockf (ships with macOS, backed by flock(2)).
#   Linux uses flock(1) from util-linux. Detected at runtime.
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

# --- Detect platform locking tool ---
# macOS: lockf(1) — ships with macOS, backed by flock(2)
# Linux: flock(1) — from util-linux
LOCK_TOOL=""
if command -v lockf >/dev/null 2>&1; then
  LOCK_TOOL="macos"
elif command -v flock >/dev/null 2>&1; then
  LOCK_TOOL="linux"
else
  echo "worktree-create.sh: WARNING — neither lockf nor flock found; running without serialization lock" >&2
  LOCK_TOOL="none"
fi

# Exponential backoff: integer milliseconds, using shell arithmetic (no bc dependency).
ms_to_sleep_args() {
  local ms=$1
  local secs=$((ms / 1000))
  local frac=$(( (ms % 1000) ))
  # Format as "N.NNN" for sleep (POSIX sleep accepts decimal on macOS/GNU)
  printf '%d.%03d' "$secs" "$frac"
}

# Error patterns that indicate transient lock contention — retry-worthy.
is_lock_contention() {
  local stderr_text=$1
  echo "$stderr_text" | grep -qE "could not lock config file|lock.*exists|File exists" 2>/dev/null
}

do_worktree_add() {
  local max_retries=5
  local delay_ms=200
  local attempt
  local last_stderr=""

  for attempt in $(seq 1 "$max_retries"); do
    last_stderr=$(git -C "$BASE_PATH" worktree add "$WORKTREE_PATH" -b "$BRANCH" 2>&1) && {
      echo "$WORKTREE_PATH"
      return 0
    }

    # Only retry on transient lock contention; abort immediately on permanent errors
    if ! is_lock_contention "$last_stderr"; then
      echo "worktree-create.sh: permanent error (not retrying):" >&2
      echo "$last_stderr" >&2
      return 1
    fi

    if [ "$attempt" -lt "$max_retries" ]; then
      local sleep_arg
      sleep_arg=$(ms_to_sleep_args "$delay_ms")
      echo "worktree-create.sh: attempt $attempt lock contention, retrying in ${delay_ms}ms..." >&2
      sleep "$sleep_arg"
      delay_ms=$((delay_ms * 2))
    fi
  done

  echo "worktree-create.sh: FAILED to create worktree after $max_retries attempts" >&2
  echo "  base_path=$BASE_PATH  branch=$BRANCH  target=$WORKTREE_PATH" >&2
  echo "  Last error: $last_stderr" >&2
  return 1
}

export -f do_worktree_add is_lock_contention ms_to_sleep_args
export BASE_PATH BRANCH WORKTREE_PATH

# --- Acquire exclusive lock and run worktree add ---
case "$LOCK_TOOL" in
  macos)
    # lockf -k: keep lock file (recommended for concurrency per lockf(1) man page;
    # prevents delete/recreate races, guarantees lock ordering).
    # -t 30: wait up to 30s for the lock before giving up.
    lockf -k -t 30 "$LOCK_FILE" bash -c 'do_worktree_add'
    ;;
  linux)
    # flock -x: exclusive lock; -w 30: wait up to 30s.
    # --no-fork: run in the same process (avoids a subshell overhead).
    flock -x -w 30 "$LOCK_FILE" bash -c 'do_worktree_add'
    ;;
  none)
    do_worktree_add
    ;;
esac
