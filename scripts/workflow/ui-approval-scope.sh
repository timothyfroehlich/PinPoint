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
#   ui_changed     true when this head needs Tim's sign-off, else false
#   last_approved  the newest earlier PR commit whose "Tim's UI sign-off" job passed
#   detail         one line for the job summary
# and the UI paths behind a wait, one per line, in $UI_APPROVAL_FILES when set.
#
# The rule: every PR with UI changes gets Tim's sign-off at least once. A head
# needs it only when the PR's own diff (`git diff merge-base(head, main) head`)
# touches a UI path in ui-paths.txt (extended regexes, matched case-insensitively
# here and in the ui-screenshot-reminder hook) and no earlier head of the PR has a
# successful "Tim's UI sign-off" job. After the first sign-off the check does not
# wait again: not for merges of main, clean or conflicted, and not for later UI
# commits. The owning agent decides when a later UI change is significant enough
# to show Tim again, and records his fresh approval with approve-ui.sh
# (pinpoint-pr-workflow 3.5). A head that passed only because it had no UI change
# is not a sign-off, so a PR whose UI arrives after such a head still waits. The
# newest signed-off head is claude-review-range.sh's last_reviewed, keyed on the
# sign-off job.
#
# --compare prints the UI paths whose own patch differs between the two commits,
# one per line, and nothing when the PR's own UI changes are the same at both.
# Each file's patch is compared by `git patch-id --stable` over a zero-context
# diff, which ignores line numbers and the surrounding lines. approve-ui.sh uses it
# when the PR head has moved past the commit Tim saw.
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

range=$(CLAUDE_REVIEW_CHECK_NAME="Tim's UI sign-off" CLAUDE_REVIEW_SKIP_LEVEL=1 GITHUB_OUTPUT="" \
  bash "${script_dir}/claude-review-range.sh" "$pr" "$head")
last_approved=$(sed -n 's/^last_reviewed=//p' <<< "$range")

files=""
[[ -z "$last_approved" ]] && files=$(own_ui_files "$head")

if [[ -n "${UI_APPROVAL_FILES:-}" ]]; then
  printf '%s\n' "$files" | sed '/^$/d' > "$UI_APPROVAL_FILES"
fi

if [[ -n "$last_approved" ]]; then
  emit ui_changed false
  detail="Tim signed off on ${last_approved:0:7}; the owning agent re-asks after significant UI changes"
elif [[ -n "$files" ]]; then
  emit ui_changed true
  detail="$(grep -c . <<< "$files") UI file(s) changed; Tim has not signed off on this PR"
else
  emit ui_changed false
  detail="no UI changes"
fi
emit last_approved "$last_approved"
emit detail "$detail"
