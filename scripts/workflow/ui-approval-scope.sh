#!/usr/bin/env bash
# ui-approval-scope.sh — does this PR head need Tim's UI approval? (PP-zxlq.4)
#
# Usage: ui-approval-scope.sh <PR> <HEAD_SHA>
#        ui-approval-scope.sh --compare <APPROVED_SHA> <HEAD_SHA>
#
# Environment: as claude-review-range.sh (GITHUB_REPOSITORY, GH_TOKEN,
# GITHUB_OUTPUT, CLAUDE_REVIEW_MAIN_REF, default origin/main).
#
# Outputs, one key=value per line (stdout, and $GITHUB_OUTPUT when set):
#   ui_changed     true | false
#   last_approved  the newest earlier PR commit with a successful UI Approval run
#   detail         one line for the job summary
# and the UI paths that need a look, one per line, in $UI_APPROVAL_FILES when set.
#
# The decision rests on the PR's own UI diff: `git diff merge-base(rev, main) rev`,
# limited to the UI paths in ui-paths.txt (extended regexes, matched
# case-insensitively here and in the ui-screenshot-reminder hook). A head needs no
# new approval when its own UI diff is the same patch as the last approved head's.
# Each file's patch is compared by `git patch-id --stable` over a zero-context
# diff, which ignores line numbers and the surrounding lines. So merging main into
# the branch never asks again, clean or conflicted, as long as the resolution
# leaves the PR's own UI changes as they were; a new UI commit, or a resolution
# that changes the PR's own lines in a UI file, asks. The last approved head is
# claude-review-range.sh's last_reviewed, keyed on the "UI Approval" check.
#
# --compare prints the UI paths whose own patch differs between the two commits,
# one per line, and nothing when Tim's approval of the first covers the second.
# approve-ui.sh uses it when the PR head has moved past the commit Tim saw.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
main_ref=${CLAUDE_REVIEW_MAIN_REF:-origin/main}

usage() {
  echo "Usage: $0 <PR> <HEAD_SHA>" >&2
  echo "       $0 --compare <APPROVED_SHA> <HEAD_SHA>" >&2
  exit 2
}

# The UI paths the PR itself changed at <rev>.
own_ui_files() {
  local mb
  mb=$(git merge-base "$main_ref" "$1")
  git -c core.quotePath=false diff --name-only --no-renames "$mb" "$1" \
    | grep -E -i -f "${script_dir}/ui-paths.txt" || true
}

# The patch-id of the PR's own change to <path> at <rev>; empty when it has none.
own_patch_id() {
  local mb
  mb=$(git merge-base "$main_ref" "$1")
  git --literal-pathspecs diff --no-renames --no-color --no-ext-diff --binary -U0 \
    "$mb" "$1" -- "$2" | git patch-id --stable | cut -d' ' -f1
}

# The UI paths whose own patch differs between <approved> and <head>.
differing_ui_files() {
  local path
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    if [[ "$(own_patch_id "$1" "$path")" != "$(own_patch_id "$2" "$path")" ]]; then
      printf '%s\n' "$path"
    fi
  done < <({ own_ui_files "$1"; own_ui_files "$2"; } | sort -u)
}

if [[ "${1:-}" == "--compare" ]]; then
  [[ $# -eq 3 ]] || usage
  differing_ui_files "$2" "$3"
  exit 0
fi

[[ $# -eq 2 ]] || usage
pr=$1
head=$2

emit() {
  printf '%s=%s\n' "$1" "$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"
  fi
}

range=$(CLAUDE_REVIEW_CHECK_NAME="UI Approval" CLAUDE_REVIEW_SKIP_LEVEL=1 GITHUB_OUTPUT="" \
  bash "${script_dir}/claude-review-range.sh" "$pr" "$head")
last_approved=$(sed -n 's/^last_reviewed=//p' <<< "$range")

if [[ -n "$last_approved" ]]; then
  files=$(differing_ui_files "$last_approved" "$head")
else
  files=$(own_ui_files "$head")
fi

if [[ -n "${UI_APPROVAL_FILES:-}" ]]; then
  printf '%s\n' "$files" | sed '/^$/d' > "$UI_APPROVAL_FILES"
fi

if [[ -n "$files" ]]; then
  count=$(grep -c . <<< "$files")
  emit ui_changed true
  if [[ -n "$last_approved" ]]; then
    detail="${count} UI file(s) changed from the approved head ${last_approved:0:7}"
  else
    detail="${count} UI file(s) changed; no earlier approval on this PR"
  fi
else
  emit ui_changed false
  if [[ -n "$last_approved" ]]; then
    detail="the PR's own UI changes match the approved head ${last_approved:0:7}"
  else
    detail="no UI changes"
  fi
fi
emit last_approved "$last_approved"
emit detail "$detail"
