#!/usr/bin/env bash
# session-start-orphan-sweep.sh — opportunistic dry-run audit of leaked
# worktree resources on Claude Code SessionStart.
#
# Calls `scripts/worktree_orphan_sweep.py --quiet` (NO --apply) to surface
# orphan slot manifest entries and orphan Supabase Docker resources from
# the failure modes documented in PP-qlzu (rm -rf without the hook, Claude
# in Web sandbox sessions). When orphans are found the sweep prints a
# single-line nudge to stderr telling you to run `--apply` manually.
#
# Why dry-run (not auto-apply): SessionStart fires on every Claude Code
# session and can affect Docker resources across the host; we want the
# user in the loop on the reclaim step.
#
# Guardrails:
#   - 6-hour throttle via ~/.cache/pinpoint/last-orphan-sweep so multiple
#     concurrent sessions don't all sweep at once.
#   - Hard 10s timeout so a hung Docker daemon never blocks session start.
#   - All errors swallowed; the script is best-effort and must never fail
#     a session start.
#
# Opt out by removing this hook entry from .claude/settings.json or by
# `touch -t 999912312359 ~/.cache/pinpoint/last-orphan-sweep` to push the
# throttle marker far into the future.

set -u

throttle_dir="${XDG_CACHE_HOME:-$HOME/.cache}/pinpoint"
throttle_file="$throttle_dir/last-orphan-sweep"
throttle_seconds=$((6 * 60 * 60))

mkdir -p "$throttle_dir" 2>/dev/null || exit 0

if [[ -f "$throttle_file" ]]; then
  last=$(stat -f %m "$throttle_file" 2>/dev/null || stat -c %Y "$throttle_file" 2>/dev/null || echo 0)
  now=$(date +%s)
  age=$((now - last))
  if (( age < throttle_seconds )); then
    exit 0
  fi
fi

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
sweep_script="$project_dir/scripts/worktree_orphan_sweep.py"

if [[ ! -f "$sweep_script" ]]; then
  exit 0
fi

# Mark the throttle marker BEFORE running so a hang doesn't repeatedly relaunch
# the sweep on each session start.
touch "$throttle_file" 2>/dev/null || true

# 10s wall-clock ceiling. macOS doesn't ship coreutils `timeout` by default but
# `gtimeout` exists when coreutils is installed, and `perl` works everywhere.
if command -v timeout >/dev/null; then
  timeout 10 python3 "$sweep_script" --quiet --repo-dir "$project_dir" >/dev/null || true
elif command -v gtimeout >/dev/null; then
  gtimeout 10 python3 "$sweep_script" --quiet --repo-dir "$project_dir" >/dev/null || true
else
  perl -e '
    use strict;
    $SIG{ALRM} = sub { kill 15, -$$; exit 0 };
    alarm 10;
    setpgrp 0, 0;
    exec @ARGV
  ' python3 "$sweep_script" --quiet --repo-dir "$project_dir" >/dev/null || true
fi

exit 0
