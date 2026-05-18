#!/usr/bin/env bash
# huddle-lib.sh — shared helpers for the huddle coordination scripts.
#
# Sourced by huddle-poll.sh, huddle-session-start.sh, huddle-whoami.sh.
# Not invoked directly.
#
# Why a shared lib: huddle state lives in `<main-worktree>/.claude/huddle/`
# so it's shared across all linked worktrees of the same clone (different
# worktrees = different sessions, same coordination map). Each script needs
# to resolve that path the same way; this lib is the single source of truth.

# huddle_state_dir — print the absolute path to the huddle state directory.
# Returns 0 on success (and prints the path), 1 if we can't locate a git
# common dir (caller should fail open: skip the hook silently).
#
# The huddle state dir is `<main-worktree-root>/.claude/huddle/`. The main
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
  printf '%s/.claude/huddle' "$main_root"
}
