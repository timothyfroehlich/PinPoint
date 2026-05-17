#!/usr/bin/env bash
# merge-pr.sh — composite gate-then-merge enforcer.
# Re-evaluates all 4 PR gates at merge time (TOCTOU safety vs label-time gates),
# squash-merges with --match-head-sha if all pass, removes ready-for-review label on failure.
#
# Usage: merge-pr.sh <PR> [--dry-run] [--force]
#   --dry-run  Print would-do summary, take no action.
#   --force    Bypass threads + currency gates ONLY. CI + no_conflict gates always run.
#
# Authorship check has no --force bypass; this script operates only on PRs you authored.

set -euo pipefail

PR=""
DRY_RUN=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
    *) if [ -z "$PR" ]; then PR="$arg"; else echo "Error: unexpected argument $arg" >&2; exit 1; fi ;;
  esac
done

if [ -z "$PR" ] || ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR> [--dry-run] [--force]" >&2
  exit 1
fi

# shellcheck source=./_pr-gates.sh
# shellcheck disable=SC1091
source "$(dirname "$0")/_pr-gates.sh"

# --- Authorship gate (no --force bypass) ---
PR_INFO=$(gh pr view "$PR" --json author,title,url,labels,headRefOid,mergeable)
PR_AUTHOR=$(jq -r .author.login <<< "$PR_INFO")
PR_TITLE=$(jq -r .title <<< "$PR_INFO")
PR_URL=$(jq -r .url <<< "$PR_INFO")
PR_LABELS=$(jq -r '.labels | map(.name) | join(",")' <<< "$PR_INFO")
PR_HEAD_SHA=$(jq -r .headRefOid <<< "$PR_INFO")
CURRENT_USER=$(gh api user --jq .login)

if [ "$PR_AUTHOR" != "$CURRENT_USER" ]; then
  echo "REFUSE: merge-pr.sh only operates on your own PRs (PR author: $PR_AUTHOR, you: $CURRENT_USER)" >&2
  exit 1
fi

echo "Target: PR #$PR — $PR_TITLE"
echo "URL: $PR_URL"
echo "Head SHA: $PR_HEAD_SHA"

# --- Run all 4 gates, collect statuses ---
GATE_FAILURES=()

run_gate() {
  local name=$1 fn=$2 enforced=$3
  local output rc
  output=$("$fn" "$PR") || rc=$?
  rc=${rc:-0}
  echo "$output"
  if [ "$rc" -ne 0 ]; then
    if [ "$FORCE" = "true" ] && [ "$enforced" = "false" ]; then
      echo "  (--force: $name gate non-pass, but bypass allowed)"
    else
      GATE_FAILURES+=("$name")
    fi
  fi
}

run_gate ci check_ci true
run_gate currency check_copilot_currency false
run_gate threads check_unresolved_threads false
run_gate no_conflict check_no_merge_conflict true

# --- Decide ---
if [ ${#GATE_FAILURES[@]} -gt 0 ]; then
  echo "RESULT: ${#GATE_FAILURES[@]} gate(s) failed: ${GATE_FAILURES[*]}"
  if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: would remove ready-for-review label if present"
    exit 1
  fi
  # Remove label if present
  if [[ ",$PR_LABELS," == *",ready-for-review,"* ]]; then
    echo "Removing ready-for-review label..."
    gh pr edit "$PR" --remove-label ready-for-review 2>/dev/null || true
  fi
  exit 1
fi

echo "RESULT: all gates passed"
if [ "$DRY_RUN" = "true" ]; then
  echo "DRY RUN: would run: gh pr merge $PR --squash --delete-branch --match-head-sha=$PR_HEAD_SHA"
  exit 0
fi

# --- Execute merge ---
# Bypass the block-direct-merge hook by setting the sentinel; hook deletes it on fire.
touch .claude-merge-bypass
gh pr merge "$PR" --squash --delete-branch --match-head-sha="$PR_HEAD_SHA"
echo "MERGED: PR #$PR"
