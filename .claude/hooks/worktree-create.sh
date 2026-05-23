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
# Stdin payload fields (supports both empirical and documented shapes):
#   Documented:
#   {
#     "session_id":        "<uuid>",
#     "transcript_path":   "<path to .jsonl>",
#     "cwd":               "<repo root absolute path>",   ← used as BASE_PATH
#     "hook_event_name":   "WorktreeCreate",
#     "worktree_id":       "<id>",                         ← used as NAME if present
#     "worktree_path":     "<path>"                        ← used as WORKTREE_PATH if present
#   }
#   Empirical (current Claude Code version fallback):
#   {
#     "session_id":        "<uuid>",
#     "transcript_path":   "<path to .jsonl>",
#     "cwd":               "<repo root absolute path>",
#     "hook_event_name":   "WorktreeCreate",
#     "name":              "agent-<hex>"                   ← fallback for NAME
#   }
#   The hook derives `BRANCH = worktree-${NAME}` to match Claude Code's native
#   pre-hook naming convention.
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

# Use `or ''` to normalize explicit JSON null → empty string (otherwise
# .get('key', '') still returns None when the key is present with a null value,
# and Python prints "None" — bypassing the -z check below).
parse_field() {
  echo "$INPUT" | python3 -c "
import sys, json
try:
    payload = json.load(sys.stdin)
except json.JSONDecodeError as exc:
    sys.stderr.write(f'worktree-create.sh: invalid JSON on stdin: {exc}\n')
    sys.exit(2)
print(payload.get('$1') or '')
" || exit $?
}

BASE_PATH=$(parse_field cwd)
WORKTREE_ID=$(parse_field worktree_id)
NAME_FIELD=$(parse_field name)
WORKTREE_PATH_FIELD=$(parse_field worktree_path)

if [ -z "$BASE_PATH" ] || { [ -z "$WORKTREE_ID" ] && [ -z "$NAME_FIELD" ]; }; then
  echo "worktree-create.sh: missing cwd, worktree_id, or name in hook input" >&2
  exit 1
fi

if [ -n "$WORKTREE_ID" ]; then
  NAME="$WORKTREE_ID"
else
  NAME="$NAME_FIELD"
fi

# Match Claude Code's pre-hook native naming so existing tooling (cleanup hook,
# worktree manifest, orchestrator skill) continues to recognize the worktree.
BRANCH="worktree-${NAME}"

if [ -n "$WORKTREE_PATH_FIELD" ]; then
  WORKTREE_PATH="$WORKTREE_PATH_FIELD"
else
  WORKTREE_PATH="${BASE_PATH}/.claude/worktrees/${NAME}"
fi

# Ensure the parent directory exists before `git worktree add` tries to write.
# (Claude Code's `name` is currently a flat `agent-<hex>` slug with no slashes,
# but mkdir -p is cheap insurance against future name conventions.)
mkdir -p "$(dirname "$WORKTREE_PATH")"

# --- Lock file: ~/.config/pinpoint/worktree-add.lock ---
# Shared across all Claude sessions on this host (kernel-level, not advisory-only).
LOCK_DIR="$HOME/.config/pinpoint"
LOCK_FILE="$LOCK_DIR/worktree-add.lock"
mkdir -p "$LOCK_DIR"

# --- Detect platform locking tool ---
# macOS: lockf(1) — ships with macOS at /usr/bin/lockf, backed by flock(2)
# Linux: flock(1) — from util-linux (installed by default on every major distro)
#
# We fail closed (exit non-zero) when neither is available. The hook's whole
# purpose is to serialize `git worktree add` across sessions; running without
# a lock would leave parallel dispatch racy while the docs claim it's safe —
# the worst-of-both-worlds. A loud failure tells the user to install the tool;
# silent unsafety would mask the very bug PP-bg45 was filed to fix.
LOCK_TOOL=""
if command -v lockf >/dev/null 2>&1; then
  LOCK_TOOL="macos"
elif command -v flock >/dev/null 2>&1; then
  LOCK_TOOL="linux"
else
  echo "worktree-create.sh: ERROR — neither lockf nor flock found in PATH." >&2
  echo "  The WorktreeCreate hook requires one to serialize parallel dispatches." >&2
  echo "  macOS: /usr/bin/lockf ships with the OS." >&2
  echo "  Linux: \`apt install util-linux\` or equivalent for your distro." >&2
  exit 1
fi

# Exponential backoff: integer milliseconds, using shell arithmetic (no bc dependency).
ms_to_sleep_args() {
  local ms=$1
  local secs=$((ms / 1000))
  local frac=$(( ms % 1000 ))
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
  echo "  cwd=$BASE_PATH  branch=$BRANCH  target=$WORKTREE_PATH" >&2
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
esac
