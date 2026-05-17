#!/usr/bin/env bash
# merge-pr.sh — composite gate-then-merge enforcer.
# Re-evaluates all 4 PR gates at merge time (TOCTOU safety vs label-time gates),
# squash-merges with --match-head-sha if all pass, removes ready-for-review label on failure.
#
# Usage: merge-pr.sh <PR> [--dry-run] [--force] [--bypass-merge-requirements]
#   --dry-run                     Print would-do summary, take no action.
#   --force                       Bypass currency + threads gates.
#   --bypass-merge-requirements   Bypass ci gate AND pass --admin to gh pr merge
#                                 (overrides GitHub branch-protection rules).
#                                 Combine with --force to bypass currency + threads + ci together.
#
# no_conflict gate is NEVER bypassable — GitHub rejects conflicting merges regardless of --admin.
# Authorship gate has no bypass; this script operates only on PRs you authored.
# Both --force and --bypass-merge-requirements require manual permission approval
# (settings.json permissions.ask).

set -euo pipefail

PR=""
DRY_RUN=false
FORCE=false
BYPASS_REQS=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)                   DRY_RUN=true ;;
    --force)                     FORCE=true ;;
    --bypass-merge-requirements) BYPASS_REQS=true ;;
    *) if [ -z "$PR" ]; then PR="$arg"; else echo "Error: unexpected argument $arg" >&2; exit 1; fi ;;
  esac
done

if [ -z "$PR" ] || ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR> [--dry-run] [--force] [--bypass-merge-requirements]" >&2
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
# Per-gate bypass kind: "none" (never bypassable), "force" (--force), "admin" (--bypass-merge-requirements).
GATE_FAILURES=()

run_gate() {
  local name=$1 fn=$2 bypass_kind=$3
  local output rc=0
  output=$("$fn" "$PR") || rc=$?
  # Fail-closed visibility: if a gate exits non-zero without emitting a status
  # token (e.g. gh/jq/API failure under pipefail), surface a synthetic FAIL so
  # the structured-output contract isn't broken by a blank line.
  if [ -z "$output" ] && [ "$rc" -ne 0 ]; then
    echo "FAIL: $name: gate exited rc=$rc with no output (likely gh/jq/API failure — see stderr)"
  else
    echo "$output"
  fi
  if [ "$rc" -ne 0 ]; then
    local bypassed=false
    case "$bypass_kind" in
      force)
        if [ "$FORCE" = "true" ]; then
          echo "  (--force: $name gate non-pass, bypassed)"
          bypassed=true
        fi
        ;;
      admin)
        if [ "$BYPASS_REQS" = "true" ]; then
          echo "  (--bypass-merge-requirements: $name gate non-pass, bypassed)"
          bypassed=true
        fi
        ;;
      none) : ;;
    esac
    if [ "$bypassed" = "false" ]; then
      GATE_FAILURES+=("$name")
    fi
  fi
}

run_gate ci          check_ci                  admin
run_gate currency    check_copilot_currency    force
run_gate threads     check_unresolved_threads  force
run_gate no_conflict check_no_merge_conflict   none

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

# Build merge args. --admin invokes admin-merge mode on GitHub, which overrides
# branch-protection rules (failed required checks, missing reviews, etc.).
MERGE_ARGS=(--squash --delete-branch --match-head-sha="$PR_HEAD_SHA")
if [ "$BYPASS_REQS" = "true" ]; then
  MERGE_ARGS+=(--admin)
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY RUN: would run: gh pr merge $PR ${MERGE_ARGS[*]}"
  exit 0
fi

# --- Execute merge ---
# The block-direct-merge PreToolUse hook fires on top-level Claude Bash invocations only.
# This `gh pr merge` runs as a subprocess of the script, so the hook does not see it —
# no sentinel needed. (A leftover sentinel would silently bypass the next user-level merge.)
gh pr merge "$PR" "${MERGE_ARGS[@]}"
echo "MERGED: PR #$PR"
