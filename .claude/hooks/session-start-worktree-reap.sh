#!/usr/bin/env bash
# session-start-worktree-reap.sh — opportunistic dry-run audit on Claude Code
# SessionStart. Runs `scripts/worktree_reap.py --quiet` (NO --apply) once,
# which prints a single line to stderr when finished worktrees, orphan slot
# entries or orphan Supabase stacks can be reclaimed (PP-49x5, PP-qlzu), or
# when part of its view is UNKNOWN — never a false zero (PP-5o7b).
#
# Why dry-run (not auto-apply): SessionStart fires on every Claude Code
# session and the reclaim step affects worktrees and Docker resources across
# the host; we want the user in the loop for it.
#
# Guardrails:
#   - 6-hour throttle via ~/.cache/pinpoint/last-worktree-reap, so multiple
#     concurrent sessions don't all audit at once.
#   - Under --quiet the script gives all its gh/docker calls a shared ~20s
#     budget; the 23s hard cap here (inside settings.json's 25s timeout)
#     covers everything else, so session start is never blocked.
#   - All errors swallowed; the audit is best-effort and must never fail a
#     session start.
#
# Opt out by removing this hook entry from .claude/settings.json or by
# `touch -t 999912312359 ~/.cache/pinpoint/last-worktree-reap` to push the
# throttle marker far into the future.

set -u

throttle_dir="${XDG_CACHE_HOME:-$HOME/.cache}/pinpoint"
throttle_file="$throttle_dir/last-worktree-reap"
throttle_seconds=$((6 * 60 * 60))

mkdir -p "$throttle_dir" 2>/dev/null || exit 0

if [[ -f "$throttle_file" ]]; then
  # GNU stat first: GNU `-f` is a valid (different) flag that silently "succeeds"
  # with unrelated filesystem-status text instead of erroring, so trying it first
  # would poison $last on Linux. BSD stat has no `-c`, so it fails cleanly there,
  # making this order safe on both.
  last=$(stat -c %Y "$throttle_file" 2>/dev/null || stat -f %m "$throttle_file" 2>/dev/null || echo 0)
  now=$(date +%s)
  age=$((now - last))
  if (( age < throttle_seconds )); then
    exit 0
  fi
fi

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
reap_script="$project_dir/scripts/worktree_reap.py"
[[ -f "$reap_script" ]] || exit 0

# Mark the throttle marker BEFORE running so a hang doesn't repeatedly relaunch
# the audit on each session start.
touch "$throttle_file" 2>/dev/null || true

# Hard wall-clock ceiling. macOS doesn't ship coreutils `timeout` by default
# but `gtimeout` exists when coreutils is installed, and `perl` works
# everywhere. stdout is discarded; the nudge goes to stderr.
reap=(python3 "$reap_script" --quiet --repo-dir "$project_dir")
if command -v timeout >/dev/null; then
  timeout 23 "${reap[@]}" >/dev/null || true
elif command -v gtimeout >/dev/null; then
  gtimeout 23 "${reap[@]}" >/dev/null || true
else
  perl -e '
    use strict;
    $SIG{ALRM} = sub { kill 15, -$$; exit 0 };
    alarm 23;
    setpgrp 0, 0;
    exec @ARGV
  ' "${reap[@]}" >/dev/null || true
fi

exit 0
