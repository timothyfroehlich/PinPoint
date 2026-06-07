#!/usr/bin/env bash
set -euo pipefail

# Reaper for on-demand Supabase preview branches. Supersedes the old
# prune-supabase-branches.sh.
#
# Invoked by .github/workflows/preview-reaper.yaml hourly + workflow_dispatch.
#
# Our branches are named `pr-<PR_NUMBER>` (the CLI cannot bind the git_branch
# field, so we never match on it). The reaper processes ONLY names matching
# `^pr-[0-9]+$`, extracts the PR number from the name, and skips everything else
# (main, production, manually-named branches).
#
# For each `pr-<N>` branch:
#   1. If PR <N> is closed/merged (or no open PR) -> destroy it.
#   2. Else, read the PR's sticky preview comment and parse `Expires:`.
#      If the expiry is in the past -> destroy it and flip the sticky comment to
#      an "expired — comment /preview to restart" state.
#
# Branches whose PR is still open and whose expiry is in the future are kept.
# A present-but-unparseable expiry fails safe (KEEP + warning).
#
# Required environment:
#   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID   Supabase management
#   GH_TOKEN                                     gh CLI
# Optional (passed through to preview-destroy.sh for Vercel cleanup):
#   VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

REPO="${GITHUB_REPOSITORY:-timothyfroehlich/PinPoint}"
HERE="$(dirname "$0")"

# Resolve the PR head branch (git ref) for Vercel env cleanup. Empty if the PR
# can't be resolved — preview-destroy.sh still tears down the Supabase branch
# and skips Vercel cleanup gracefully.
resolve_git_branch() {
  # resolve_git_branch <pr-number>
  gh pr view "$1" --repo "$REPO" --json headRefName --jq '.headRefName' 2>/dev/null || true
}

destroy() {
  # destroy <pr-number> <git-branch>
  PR_NUMBER="$1" \
  GIT_BRANCH="${2:-unknown}" \
  SUPABASE_PROJECT_ID="$SUPABASE_PROJECT_ID" \
    bash "${HERE}/preview-destroy.sh"
}

mark_expired() {
  # mark_expired <pr-number> <git-branch>
  local pr="$1" gb="$2"
  bash "${HERE}/preview-status.sh" expired "$gb" \
    | bash "${HERE}/sticky-comment.sh" upsert "$pr" - || \
    echo "::warning::failed to update sticky comment on PR #${pr}"
}

# Parse the `Expires:` ISO-8601 timestamp from a sticky comment body and print
# its epoch seconds. Distinguishes three outcomes via stdout:
#   ""        -> no `Expires:` field present (stopped/expired comment, or none)
#   "unparseable" -> field present but the timestamp could not be parsed
#                    (caller MUST fail safe and KEEP the branch)
#   <digits>  -> epoch seconds
parse_expiry_epoch() {
  local body="$1"
  local iso
  iso="$(echo "$body" | grep -oE 'Expires:[[:space:]]*[0-9TZ:.+-]+' \
    | head -n1 \
    | sed -E 's/^Expires:[[:space:]]*//')"
  [[ -z "$iso" ]] && return 0
  # GNU date (ubuntu runners) understands ISO-8601 directly.
  local epoch
  if epoch="$(date -u -d "$iso" +%s 2>/dev/null)"; then
    echo "$epoch"
  else
    echo "unparseable"
  fi
  return 0
}

echo "Listing Supabase preview branches..."
ALL_BRANCHES_JSON="$(supabase branches list \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --output json 2>&1)" || {
  echo "ERROR: failed to list Supabase branches:" >&2
  echo "$ALL_BRANCHES_JSON" >&2
  exit 1
}

BRANCH_COUNT="$(echo "$ALL_BRANCHES_JSON" | jq 'length')"
echo "Total preview branches: ${BRANCH_COUNT}"

if [[ "$BRANCH_COUNT" -eq 0 ]]; then
  echo "Nothing to reap."
  exit 0
fi

NOW_EPOCH="$(date -u +%s)"

echo "$ALL_BRANCHES_JSON" | jq -r '.[].name' | while IFS= read -r name; do
  # Process ONLY our deterministic `pr-<N>` branches. Everything else (main,
  # production, manually-created branches) is left untouched.
  if [[ ! "$name" =~ ^pr-[0-9]+$ ]]; then
    echo "SKIP (not a pr-<N> branch): ${name}"
    continue
  fi
  pr_number="${name#pr-}"

  # Is the PR still open?
  pr_state="$(gh pr view "$pr_number" \
    --repo "$REPO" \
    --json state \
    --jq '.state' 2>/dev/null || true)"

  if [[ "$pr_state" != "OPEN" ]]; then
    echo "DESTROY (PR closed/merged/missing): ${name} (PR #${pr_number}, state=${pr_state:-none})"
    destroy "$pr_number" "$(resolve_git_branch "$pr_number")"
    continue
  fi

  # Open PR — check the sticky comment's expiry.
  sticky_body="$(GITHUB_REPOSITORY="$REPO" bash "${HERE}/sticky-comment.sh" find "$pr_number" || true)"

  if [[ -z "$sticky_body" ]]; then
    # Branch exists but no sticky comment claims it. This is an orphan (e.g. a
    # stopped/expired preview whose branch lingered). Reap it.
    echo "DESTROY (no sticky comment): ${name} (PR #${pr_number})"
    destroy "$pr_number" "$(resolve_git_branch "$pr_number")"
    continue
  fi

  expiry_epoch="$(parse_expiry_epoch "$sticky_body")"

  if [[ "$expiry_epoch" == "unparseable" ]]; then
    # Field is present but we couldn't parse the timestamp. Fail safe: never
    # destroy a branch we can't prove is expired. Surface a warning instead.
    echo "::warning::KEEP (unparseable Expires: in sticky): ${name} (PR #${pr_number})"
    continue
  fi

  if [[ -z "$expiry_epoch" ]]; then
    # Sticky comment exists but has no `Expires:` field (already expired/stopped).
    # Reap any lingering branch; leave the comment as-is.
    echo "DESTROY (no active expiry in sticky): ${name} (PR #${pr_number})"
    destroy "$pr_number" "$(resolve_git_branch "$pr_number")"
    continue
  fi

  if [[ "$expiry_epoch" -le "$NOW_EPOCH" ]]; then
    git_branch="$(resolve_git_branch "$pr_number")"
    echo "DESTROY (expired): ${name} (PR #${pr_number}, expired $((NOW_EPOCH - expiry_epoch))s ago)"
    destroy "$pr_number" "$git_branch"
    mark_expired "$pr_number" "$git_branch"
  else
    echo "KEEP: ${name} (PR #${pr_number}, expires in $((expiry_epoch - NOW_EPOCH))s)"
  fi
done

echo "Reap complete."
