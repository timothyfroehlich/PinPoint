#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-lib.sh — shared helpers for the huddle coordination scripts.
#
# Sourced by huddle-poll.sh, huddle-session-start.sh, huddle-whoami.sh.
# Not invoked directly. Harness-agnostic — used by any agent harness whose
# bootstrap shim routes through these scripts.
#
# Why a shared lib: huddle state lives in `<main-worktree>/.agents/huddle/`
# so it's shared across all linked worktrees of the same clone AND across
# every agent harness using the worktree (Claude Code, Antigravity, etc.).
# Each script needs to resolve that path the same way; this lib is the
# single source of truth.

# huddle_state_dir — print the absolute path to the huddle state directory.
# Returns 0 on success (and prints the path), 1 if we can't locate a git
# common dir (caller should fail open: skip the hook silently).
#
# The huddle state dir is `<main-worktree-root>/.agents/huddle/`. The main
# worktree is the original clone — the worktree where `.git/` is a real
# directory (not a `.git` file pointing into `.git/worktrees/`). Linked
# worktrees share state with the main worktree via this resolver.
#
# Resolution uses `git rev-parse --git-common-dir`:
#   - Main worktree:   returns ".git" (relative)
#   - Linked worktree: returns absolute path to <main>/.git
# `dirname` of the resolved-to-absolute git-common-dir is the main worktree.
#
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_state_dir() {
  local common_dir abs_common main_root
  common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || return 1
  if [[ "$common_dir" = /* ]]; then
    abs_common="$common_dir"
  else
    # Relative path (main worktree case) — resolve via the current pwd.
    abs_common=$(cd "$common_dir" 2>/dev/null && pwd) || return 1
  fi
  main_root=$(dirname "$abs_common")
  printf '%s/.agents/huddle' "$main_root"
}

# huddle_today_bead_id — print the ID of today's active coordination bead.
# Returns 0 on success (and prints the ID), non-zero + empty on any failure.
# Fail-open: callers MUST treat a non-zero return as "skip quietly".
#
# Resolution path:
#   huddle_state_dir → config.json → root_bead_id → `bd show` root notes JSON
#   → .today_bead.id
#
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_today_bead_id() {
  local state_dir config_file root_id notes_str today_id
  state_dir=$(huddle_state_dir) || return 1
  config_file="$state_dir/config.json"
  [[ -f "$config_file" ]] || return 1
  root_id=$(jq -r '.root_bead_id // ""' "$config_file" 2>/dev/null) || return 1
  [[ -n "$root_id" ]] || return 1
  notes_str=$(bd show "$root_id" --json 2>/dev/null | jq -r '.[0].notes // ""' 2>/dev/null) || return 1
  [[ -n "$notes_str" ]] || return 1
  today_id=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null) || return 1
  [[ -n "$today_id" ]] || return 1
  printf '%s' "$today_id"
}
