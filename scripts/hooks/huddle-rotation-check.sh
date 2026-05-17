#!/usr/bin/env bash
# huddle-rotation-check.sh — shared helper sourced by huddle-poll.sh and
# huddle-session-start.sh. Defines a single function `huddle_rotation_needed`
# that returns 0 if a coordination-bead rotation is needed, 1 otherwise.
#
# This file is a STUB in PR #1357 (the foundation PR). It always returns 1
# ("no rotation needed") because rotation isn't implemented yet — PP-cvh is
# still the single coordination bead. The real date-compare logic lands in
# the follow-up rotation PR, at which point this stub is replaced with the
# implementation described in §5.3 of:
#   docs/superpowers/specs/2026-05-17-huddle-system-design.md
#
# Design intent for the eventual real implementation:
#   - Read ~/.config/pinpoint/huddle.config.json for root_bead_id
#   - bd show <root> --json to extract today_bead.date from notes
#   - Compare to $(date +%F) (local date)
#   - Return 0 if mismatch (rotation needed), 1 if match (no rotation needed)
#
# Calling pattern in both hooks:
#   source "$(dirname "$0")/huddle-rotation-check.sh"
#   if huddle_rotation_needed; then
#     # emit "rotation needed" notice and skip subsequent steps
#   fi
#
# Until the real implementation lands, this stub keeps the hooks running
# the existing polling/identity logic unchanged.

# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_rotation_needed() {
  return 1
}
