#!/usr/bin/env bash
# merge-pr.sh — composite gate-then-merge enforcer.
# Re-evaluates all 5 PR gates at merge time (TOCTOU safety vs label-time gates),
# squash-merges with --match-head-commit if all pass, removes ready-for-review label on failure.
#
# Usage: merge-pr.sh <PR> --human [--dry-run] [--force] [--bypass-merge-requirements]
#   --human                       REQUIRED to actually merge. Merging is human-authorized
#                                 only (PP-wi85) — this script refuses to execute a merge
#                                 without it. Not required for --dry-run (gate preview is
#                                 safe to run without a human present).
#   --dry-run                     Print would-do summary, take no action. Does not require --human.
#   --force                       Bypass currency + threads + reviewed gates.
#   --bypass-merge-requirements   Bypass ci gate AND pass --admin to gh pr merge
#                                 (overrides GitHub branch-protection rules).
#                                 Combine with --force to bypass currency + threads + reviewed + ci together.
#
# Canonical human-run command: scripts/workflow/merge-pr.sh <PR> --human
#
# no_conflict gate is NEVER bypassable — GitHub rejects conflicting merges regardless of --admin.
# Authorship gate has no bypass; this script operates only on PRs you authored OR PRs authored
# by trusted Dependabot bot identities (app/dependabot, dependabot[bot], dependabot).
# Both --force and --bypass-merge-requirements require manual permission approval
# (settings.json permissions.ask).
#
# Defense-in-depth note (PP-wi85): the --human flag is a same-tool guard against
# non-interactive/scripted invocation — it does not (and cannot) verify a human is
# actually typing the command. It stops accidental/scripted calls; the real
# enforcement boundary is that Claude Code's block-direct-merge.cjs PreToolUse hook
# refuses to let an agent invoke this script at all (any flags), in ANY harness that
# wires the hook. Cross-tool (Codex/Gemini/Antigravity) coverage is best-effort only.

set -euo pipefail

PR=""
DRY_RUN=false
FORCE=false
BYPASS_REQS=false
HUMAN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)                   DRY_RUN=true ;;
    --force)                     FORCE=true ;;
    --bypass-merge-requirements) BYPASS_REQS=true ;;
    --human)                     HUMAN=true ;;
    *) if [ -z "$PR" ]; then PR="$arg"; else echo "Error: unexpected argument $arg" >&2; exit 1; fi ;;
  esac
done

if [ -z "$PR" ] || ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR> --human [--dry-run] [--force] [--bypass-merge-requirements]" >&2
  exit 1
fi

# Merges are human-authorized only (PP-wi85). --dry-run is exempt — it takes no
# action, so an agent previewing gate status before handing off to Tim is fine.
if [ "$DRY_RUN" != "true" ] && [ "$HUMAN" != "true" ]; then
  echo "REFUSE: merges are human-authorized only. Canonical command: scripts/workflow/merge-pr.sh $PR --human" >&2
  echo "        (add --dry-run instead to preview gate status without merging)" >&2
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

is_trusted_author() {
  local author="$1"
  [ "$author" = "$CURRENT_USER" ] && return 0
  case "$author" in
    "app/dependabot"|"dependabot[bot]"|"dependabot") return 0 ;;
  esac
  return 1
}

if ! is_trusted_author "$PR_AUTHOR"; then
  echo "REFUSE: merge-pr.sh only operates on your own PRs or Dependabot PRs (PR author: $PR_AUTHOR, you: $CURRENT_USER)" >&2
  exit 1
fi

echo "Target: PR #$PR — $PR_TITLE"
echo "URL: $PR_URL"
echo "Head SHA: $PR_HEAD_SHA"

# --- Run all 5 gates, collect statuses ---
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
run_gate reviewed    check_review_happened     force
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
# Branch deletion is handled by the repo's auto-delete setting — passing --delete-branch
# from a worktree fails the local cleanup step because main is held by the root checkout.
MERGE_ARGS=(--squash --match-head-commit="$PR_HEAD_SHA")
if [ "$BYPASS_REQS" = "true" ]; then
  MERGE_ARGS+=(--admin)
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY RUN: would run: gh pr merge $PR ${MERGE_ARGS[*]}"
  exit 0
fi

# --- Execute merge ---
# Reaching this line already required passing the --human gate above. The
# block-direct-merge PreToolUse hook (Claude Code) additionally refuses to let
# an agent invoke this script at all — see the header comment. This `gh pr
# merge` runs as a subprocess of the script either way, so the hook does not
# see it directly; --human is the guard for that layer.
gh pr merge "$PR" "${MERGE_ARGS[@]}"
echo "MERGED: PR #$PR"

# --- Post huddle coordination notice (fail-open) ---
# The merge is already done — a huddle failure must NEVER propagate an error.
# shellcheck source=../hooks/huddle-lib.sh disable=SC1091
(
  set +e
  set +u
  set +o pipefail
  _HUDDLE_LIB="$(dirname "$0")/../hooks/huddle-lib.sh"
  if [[ ! -f "$_HUDDLE_LIB" ]]; then
    exit 0
  fi
  source "$_HUDDLE_LIB"
  _TODAY=$(huddle_today_bead_id 2>/dev/null) || exit 0
  [[ -n "$_TODAY" ]] || exit 0
  # Parse PinPoint bead ID from PR title (convention: trailing "(PP-xxx)").
  # Bead IDs may include dots (e.g. PP-yxw.9), so allow [a-z0-9.] in the capture.
  _BEAD_ID=$(printf '%s' "$PR_TITLE" | grep -oE '\(PP-[a-z0-9.]+\)' | tail -1 | tr -d '()' || echo "")
  # Compact changed-files hint for collision awareness (top-level dirs, first 5)
  _FILES=$(gh pr view "$PR" --json files --jq '[.files[].path | split("/")[0]] | unique | .[:5] | join(", ")' 2>/dev/null || echo "")
  _BEAD_PART=""
  [[ -n "$_BEAD_ID" ]] && _BEAD_PART=" ($_BEAD_ID)"
  _FILES_PART=""
  [[ -n "$_FILES" ]] && _FILES_PART=" [touched: $_FILES]"
  _SIGN="${HUDDLE_NAME:-huddle-auto}"
  _MSG="Merged PR #$PR$_BEAD_PART: $PR_TITLE$_FILES_PART. Sync main if you have active branches. —$_SIGN"
  bd comments add "$_TODAY" "$_MSG" >/dev/null 2>&1 || true
) || true
