#!/usr/bin/env bash
# session-start-orphan-sweep.sh — opportunistic dry-run audit of leaked
# worktree resources on Claude Code SessionStart. Two complementary passes,
# neither of which ever removes anything:
#
# 1. `scripts/worktree_orphan_sweep.py --quiet` (NO --apply) surfaces orphan
#    slot manifest entries and orphan Supabase Docker resources from the
#    failure modes documented in PP-qlzu (rm -rf without the hook, Claude in
#    Web sandbox sessions). If Docker can't be enumerated the nudge says
#    UNKNOWN rather than reporting zero — a false zero here is what let
#    ~557 MB of orphan volumes accumulate unseen (PP-5o7b).
# 2. `scripts/worktree_reap.py --quiet` (NO --apply) surfaces worktrees still
#    on disk whose work has already landed on main. The sweep is blind to
#    these by construction — a worktree that still exists is "active" to it —
#    so without this pass they accumulate silently (PP-49x5).
#
# Both print a single-line nudge to stderr when there is something to reclaim,
# and both exit non-zero when their view was incomplete; this hook deliberately
# swallows that so session start is never blocked.
#
# Why dry-run (not auto-apply): SessionStart fires on every Claude Code
# session and can affect Docker resources and worktrees across the host; we
# want the user in the loop on the reclaim step.
#
# Guardrails:
#   - 6-hour throttle via ~/.cache/pinpoint/last-orphan-sweep, shared by both
#     passes, so multiple concurrent sessions don't all audit at once.
#   - Hard 10s timeout each, so a hung Docker daemon or an unreachable `gh`
#     never blocks session start.
#   - All errors swallowed; the scripts are best-effort and must never fail
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
sweep_script="$project_dir/scripts/worktree_orphan_sweep.py"
reap_script="$project_dir/scripts/worktree_reap.py"

if [[ ! -f "$sweep_script" && ! -f "$reap_script" ]]; then
  exit 0
fi

# Mark the throttle marker BEFORE running so a hang doesn't repeatedly relaunch
# the audits on each session start.
touch "$throttle_file" 2>/dev/null || true

# 10s wall-clock ceiling, applied per script. macOS doesn't ship coreutils
# `timeout` by default but `gtimeout` exists when coreutils is installed, and
# `perl` works everywhere. Separate budgets because the two audits fail
# independently — a wedged Docker daemon must not swallow the reap's report,
# and an unreachable `gh` must not swallow the sweep's.
run_capped() {
  local script="$1"
  [[ -f "$script" ]] || return 0
  if command -v timeout >/dev/null; then
    timeout 10 python3 "$script" --quiet --repo-dir "$project_dir" >/dev/null || true
  elif command -v gtimeout >/dev/null; then
    gtimeout 10 python3 "$script" --quiet --repo-dir "$project_dir" >/dev/null || true
  else
    perl -e '
      use strict;
      $SIG{ALRM} = sub { kill 15, -$$; exit 0 };
      alarm 10;
      setpgrp 0, 0;
      exec @ARGV
    ' python3 "$script" --quiet --repo-dir "$project_dir" >/dev/null || true
  fi
}

run_capped "$sweep_script"
run_capped "$reap_script"

exit 0
