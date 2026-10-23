#!/usr/bin/env bash
# ui-approval-scope.sh — does this PR head need Tim's UI approval? (PP-zxlq.4)
#
# Usage: ui-approval-scope.sh <PR> <HEAD_SHA>
#
# Environment: as claude-review-range.sh (GITHUB_REPOSITORY, GH_TOKEN,
# GITHUB_OUTPUT, CLAUDE_REVIEW_MAIN_REF).
#
# Outputs, one key=value per line (stdout, and $GITHUB_OUTPUT when set):
#   ui_changed     true | false
#   last_approved  the newest earlier PR commit with a successful UI Approval run
#   detail         one line for the job summary
# and the changed UI paths, one per line, in $UI_APPROVAL_FILES when set.
#
# An approval covers a head until a later commit changes a UI path. The range
# is claude-review-range.sh's, keyed on the "UI Approval" check instead of
# "Claude Review": the commits since the newest earlier head whose UI Approval
# passed, with main's changes left out. UI paths are the extended regexes in
# ui-paths.txt, matched case-insensitively here, in merge-handoff.sh, and in the
# ui-screenshot-reminder hook.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <PR> <HEAD_SHA>" >&2
  exit 2
fi
pr=$1
head=$2
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

emit() {
  printf '%s=%s\n' "$1" "$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"
  fi
}

range=$(CLAUDE_REVIEW_CHECK_NAME="UI Approval" CLAUDE_REVIEW_SKIP_LEVEL=1 GITHUB_OUTPUT="" \
  bash "${script_dir}/claude-review-range.sh" "$pr" "$head")
mode=$(sed -n 's/^mode=//p' <<< "$range")
base=$(sed -n 's/^base=//p' <<< "$range")
last_approved=$(sed -n 's/^last_reviewed=//p' <<< "$range")

files=""
if [[ "$mode" != "skip" ]]; then
  files=$(git -c core.quotePath=false diff --name-only --no-renames "$base" "$head" \
    | grep -E -i -f "${script_dir}/ui-paths.txt" || true)
fi

if [[ -n "${UI_APPROVAL_FILES:-}" ]]; then
  printf '%s\n' "$files" | sed '/^$/d' > "$UI_APPROVAL_FILES"
fi

if [[ -n "$files" ]]; then
  count=$(grep -c . <<< "$files")
  emit ui_changed true
  if [[ -n "$last_approved" ]]; then
    detail="${count} UI file(s) changed since the approval at ${last_approved:0:7}"
  else
    detail="${count} UI file(s) changed; no earlier approval on this PR"
  fi
else
  emit ui_changed false
  if [[ -n "$last_approved" ]]; then
    detail="no UI changes since the approval at ${last_approved:0:7}"
  else
    detail="no UI changes"
  fi
fi
emit last_approved "$last_approved"
emit detail "$detail"
