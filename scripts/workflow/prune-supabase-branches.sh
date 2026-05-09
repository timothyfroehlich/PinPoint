#!/usr/bin/env bash
set -euo pipefail

# Prune Supabase branch DBs for PRs without the 'preview' label.
# Run by .github/workflows/supabase-branch-cleanup.yaml on cron + manual.
#
# Strategy:
# 1. Get list of open PRs that have the 'preview' label (these stay)
# 2. List all Supabase preview branches
# 3. For each branch, find which open PR it corresponds to (via git_branch field)
# 4. If the PR is NOT in the keep list (or PR is closed/missing), delete the branch
#
# Authentication: reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID from env.
# GH_TOKEN must also be set for `gh` CLI calls.

REPO="${GITHUB_REPOSITORY:-timothyfroehlich/PinPoint}"

# Collect open PR numbers that have the 'preview' label (newline-separated)
PREVIEW_PRS=$(gh pr list \
  --repo "$REPO" \
  --state open \
  --label preview \
  --json number \
  --jq '.[].number' 2>/dev/null || true)

echo "Open PRs with 'preview' label: $(echo "$PREVIEW_PRS" | tr '\n' ' ' | xargs)"

# List all preview branches as JSON. Requires SUPABASE_ACCESS_TOKEN and
# SUPABASE_PROJECT_ID to be set in the environment.
ALL_BRANCHES_JSON=$(supabase branches list \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --output json 2>&1) || {
  echo "ERROR: failed to list Supabase branches:" >&2
  echo "$ALL_BRANCHES_JSON" >&2
  exit 1
}

BRANCH_COUNT=$(echo "$ALL_BRANCHES_JSON" | jq 'length')
echo "Total Supabase preview branches found: $BRANCH_COUNT"

if [[ "$BRANCH_COUNT" -eq 0 ]]; then
  echo "No preview branches to prune."
  exit 0
fi

echo "$ALL_BRANCHES_JSON" | jq -c '.[]' | while IFS= read -r branch; do
  name=$(echo "$branch" | jq -r '.name')
  git_branch=$(echo "$branch" | jq -r '.git_branch // empty')

  # Skip production / main branches (they have no git_branch or are named accordingly)
  if [[ -z "$git_branch" || "$name" == "production" || "$name" == "main" || "$git_branch" == "main" ]]; then
    echo "SKIP (production/main): $name"
    continue
  fi

  # Look up whether an open PR exists for this git branch
  pr_number=$(gh pr list \
    --repo "$REPO" \
    --state open \
    --head "$git_branch" \
    --json number \
    --jq '.[0].number // empty' 2>/dev/null || true)

  if [[ -z "$pr_number" ]]; then
    # No open PR for this branch — it's closed or was deleted
    echo "DELETE (PR closed/missing): $name (git branch: $git_branch)"
    supabase branches delete "$name" \
      --project-ref "$SUPABASE_PROJECT_ID" \
      --yes || echo "  WARNING: delete failed for $name (may already be gone)"
    continue
  fi

  # Check if this PR number is in the preview keep-list
  if echo "$PREVIEW_PRS" | grep -qx "$pr_number"; then
    echo "KEEP: $name (PR #$pr_number has 'preview' label)"
  else
    echo "DELETE: $name (PR #$pr_number does not have 'preview' label)"
    supabase branches delete "$name" \
      --project-ref "$SUPABASE_PROJECT_ID" \
      --yes || echo "  WARNING: delete failed for $name"
  fi
done

echo "Prune complete."
