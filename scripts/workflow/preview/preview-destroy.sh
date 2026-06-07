#!/usr/bin/env bash
set -euo pipefail

# Tear down an on-demand Supabase preview branch for a PR and remove the
# git-branch-scoped Vercel preview env vars.
#
# Invoked by:
#   - .github/workflows/preview-control.yaml on `/preview stop`
#   - scripts/workflow/preview/preview-reap.sh on expiry / closed PR
#
# Idempotent: succeeds even if the branch or env vars are already gone.
#
# Required environment:
#   GIT_BRANCH             git branch name whose preview should be destroyed
#   SUPABASE_PROJECT_ID    production project ref
# Optional (Vercel cleanup is best-effort and skipped if unset):
#   VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

: "${GIT_BRANCH:?GIT_BRANCH is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

# --- Delete the Supabase branch ---------------------------------------------

echo "::group::Delete Supabase branch for git branch '${GIT_BRANCH}'"
BRANCHES_JSON="$(supabase branches list \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --output json 2>/dev/null || echo '[]')"

BRANCH_NAME="$(echo "$BRANCHES_JSON" \
  | jq -r --arg gb "$GIT_BRANCH" \
    '.[] | select(.git_branch == $gb) | .name' \
  | head -n1)"

if [[ -z "$BRANCH_NAME" ]]; then
  echo "No Supabase branch found for '${GIT_BRANCH}' (already gone)"
else
  echo "Deleting Supabase branch: ${BRANCH_NAME}"
  supabase branches delete "$BRANCH_NAME" \
    --project-ref "$SUPABASE_PROJECT_ID" \
    --yes || echo "::warning::delete failed for ${BRANCH_NAME} (may already be gone)"
fi
echo "::endgroup::"

# --- Remove git-branch-scoped Vercel preview env vars -----------------------
# PENDING LIVE VERIFICATION (same caveat as preview-create.sh). Best-effort:
# missing vars are not an error. `vercel env rm NAME preview <git-branch> --yes`.

# Invoked via npx so no global install is needed; override $VERCEL to pin.
VERCEL="${VERCEL:-npx --yes vercel@latest}"

remove_vercel_env() {
  echo "::group::Remove Vercel env vars for branch '${GIT_BRANCH}'"
  if [[ -z "${VERCEL_TOKEN:-}" || -z "${VERCEL_ORG_ID:-}" || -z "${VERCEL_PROJECT_ID:-}" ]]; then
    echo "Vercel credentials not set; skipping Vercel env cleanup"
    echo "::endgroup::"
    return 0
  fi
  export VERCEL_ORG_ID VERCEL_PROJECT_ID

  local name
  for name in \
    NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SUPABASE_ANON_KEY \
    POSTGRES_URL \
    SUPABASE_URL \
    SUPABASE_SERVICE_ROLE_KEY; do
    if $VERCEL env rm "$name" preview "$GIT_BRANCH" --yes --token="$VERCEL_TOKEN" \
      >/dev/null 2>&1; then
      echo "  removed ${name}"
    else
      echo "  ${name} not present (skipped)"
    fi
  done
  echo "::endgroup::"
}

remove_vercel_env

echo "Teardown complete for git branch '${GIT_BRANCH}'"
