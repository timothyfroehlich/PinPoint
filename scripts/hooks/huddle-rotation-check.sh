#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-rotation-check.sh — shared helper sourced by huddle-poll.sh and
# huddle-session-start.sh. Defines a single function `huddle_rotation_needed`
# that returns 0 if a coordination-bead rotation is needed, 1 otherwise.
#
# Design: reads <STATE_DIR>/config.json for root_bead_id, then reads the root
# bead's notes JSON via `bd show <root> --json`, extracts today_bead.date, and
# compares to $(date +%F) (local date). Returns 0 if mismatch (rotation
# needed), 1 if match (no rotation needed) or if config is missing/unreadable
# (hooks degrade gracefully — only SessionStart emits the user-visible notice).
#
# Calling pattern in both hooks:
#   source "$(dirname "$0")/huddle-rotation-check.sh"
#   if huddle_rotation_needed; then
#     # emit "rotation needed" notice and skip subsequent steps
#   fi
#
# Requires huddle-lib.sh to be sourced before calling, OR resolves the lib
# itself if STATE_DIR is not yet set. Both hooks source this file after
# sourcing huddle-lib.sh, so the fast path (STATE_DIR already set) is normal.

# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_rotation_needed() {
  local state_dir config_file root_id root_json notes_str today_bead_date today

  # Resolve state dir — re-use caller's STATE_DIR if already set, otherwise
  # source huddle-lib.sh to compute it.
  if [[ -n "${STATE_DIR:-}" ]]; then
    state_dir="$STATE_DIR"
  else
    local lib_script
    lib_script="$(dirname "${BASH_SOURCE[0]}")/huddle-lib.sh"
    [[ -f "$lib_script" ]] || return 1
    # shellcheck source=huddle-lib.sh disable=SC1091
    source "$lib_script"
    state_dir=$(huddle_state_dir) || return 1
  fi

  config_file="$state_dir/config.json"
  [[ -f "$config_file" ]] || return 1  # not bootstrapped → no rotation needed

  root_id=$(jq -r '.root_bead_id // ""' "$config_file" 2>/dev/null)
  [[ -n "$root_id" ]] || return 1

  # Fetch the root bead's notes JSON. bd show outputs a JSON array; we pick
  # the first element's `notes` field (a JSON string). If bd is unavailable,
  # notes is empty, or notes fails to parse, fail open (return 1).
  root_json=$(bd show "$root_id" --json 2>/dev/null) || return 1
  notes_str=$(printf '%s' "$root_json" | jq -r '.[0].notes // ""' 2>/dev/null) || return 1
  [[ -n "$notes_str" ]] || return 1

  today_bead_date=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('date', ''))
except Exception:
    print('')
" 2>/dev/null) || return 1
  [[ -n "$today_bead_date" ]] || return 1

  today=$(date +%F)
  if [[ "$today_bead_date" != "$today" ]]; then
    return 0  # rotation needed
  fi
  return 1  # up to date
}
