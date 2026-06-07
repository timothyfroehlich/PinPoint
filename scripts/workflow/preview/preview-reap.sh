#!/usr/bin/env bash
set -euo pipefail

# Reaper for on-demand Supabase preview branches. Supersedes the old
# prune-supabase-branches.sh.
#
# Invoked by .github/workflows/preview-reaper.yaml hourly + workflow_dispatch.
#
# For every Supabase preview branch:
#   1. If its PR is closed/merged (or no open PR exists) -> destroy it.
#   2. Else, read the PR's sticky preview comment and parse `Expires:`.
#      If the expiry is in the past -> destroy it and flip the sticky comment to
#      an "expired — comment /preview to restart" state.
#
# Branches whose PR is still open and whose expiry is in the future are kept.
#
# Required environment:
#   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID   Supabase management
#   GH_TOKEN                                     gh CLI
# Optional (passed through to preview-destroy.sh for Vercel cleanup):
#   VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

REPO="${GITHUB_REPOSITORY:-timothyfroehlich/PinPoint}"
HERE="$(dirname "$0")"

destroy() {
  # destroy <git-branch>
  GIT_BRANCH="$1" \
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

echo "$ALL_BRANCHES_JSON" | jq -c '.[]' | while IFS= read -r branch; do
  name="$(echo "$branch" | jq -r '.name')"
  git_branch="$(echo "$branch" | jq -r '.git_branch // empty')"

  # Skip production / main.
  if [[ -z "$git_branch" || "$name" == "production" || "$name" == "main" || "$git_branch" == "main" ]]; then
    echo "SKIP (production/main): ${name}"
    continue
  fi

  # Find an OPEN PR for this git branch.
  pr_number="$(gh pr list \
    --repo "$REPO" \
    --state open \
    --head "$git_branch" \
    --json number \
    --jq '.[0].number // empty' 2>/dev/null || true)"

  if [[ -z "$pr_number" ]]; then
    echo "DESTROY (PR closed/missing): ${name} (git branch: ${git_branch})"
    destroy "$git_branch"
    continue
  fi

  # Open PR — check the sticky comment's expiry.
  sticky_body="$(GITHUB_REPOSITORY="$REPO" bash "${HERE}/sticky-comment.sh" find "$pr_number" || true)"

  if [[ -z "$sticky_body" ]]; then
    # Branch exists but no sticky comment claims it. This is an orphan (e.g. a
    # stopped/expired preview whose branch lingered). Reap it.
    echo "DESTROY (no sticky comment): ${name} (PR #${pr_number})"
    destroy "$git_branch"
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
    destroy "$git_branch"
    continue
  fi

  if [[ "$expiry_epoch" -le "$NOW_EPOCH" ]]; then
    echo "DESTROY (expired): ${name} (PR #${pr_number}, expired $((NOW_EPOCH - expiry_epoch))s ago)"
    destroy "$git_branch"
    mark_expired "$pr_number" "$git_branch"
  else
    echo "KEEP: ${name} (PR #${pr_number}, expires in $((expiry_epoch - NOW_EPOCH))s)"
  fi
done

echo "Reap complete."
