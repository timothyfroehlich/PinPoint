#!/bin/bash
# scripts/workflow/label-ready.sh
# Labels a PR as ready-for-review if it passes all CI checks and has 0 Copilot comments.
# Optionally cleans up the associated worktree.
#
# Usage:
#   ./scripts/workflow/label-ready.sh 918                    # Check and label if ready
#   ./scripts/workflow/label-ready.sh 918 --cleanup          # Also remove worktree
#   ./scripts/workflow/label-ready.sh 918 --force             # Label even with Copilot comments
#   ./scripts/workflow/label-ready.sh 918 --dry-run           # Show what would happen

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/workflow/_review-config.sh
source "$SCRIPT_DIR/_review-config.sh"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [--cleanup] [--force] [--dry-run]"
    exit 1
fi

PR=$1
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be numeric (e.g. '945'); received '$PR'."
    exit 1
fi
shift

CLEANUP=false
FORCE=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --cleanup) CLEANUP=true ;;
        --force) FORCE=true ;;
        --dry-run) DRY_RUN=true ;;
        *) echo "Error: unknown option '$arg'."; echo "Usage: $0 <PR_NUMBER> [--cleanup] [--force] [--dry-run]"; exit 1 ;;
    esac
done

# Get branch and draft status
pr_data=$(gh pr view "$PR" --json headRefName,isDraft 2>/dev/null) || { echo "FAIL: Could not fetch PR #${PR}."; exit 1; }
branch=$(echo "$pr_data" | jq -r '.headRefName')
is_draft=$(echo "$pr_data" | jq -r '.isDraft')

echo "PR #${PR} — branch: ${branch}"

# Check draft
if [ "$is_draft" = "true" ]; then
    echo "SKIP: PR is a draft."
    exit 1
fi

# Check CI
checks=$(gh pr checks "$PR" --json name,state 2>&1) || { echo "FAIL: Could not fetch CI checks for PR #${PR}."; exit 1; }
total=$(echo "$checks" | jq 'length')
failed=$(echo "$checks" | jq '[.[] | select((.state != "SUCCESS") and (.state != "IN_PROGRESS") and (.state != "QUEUED") and (.state != "PENDING") and (.state != "CANCELLED") and (.state != "SKIPPED") and (.name | startswith("codecov/") | not))] | length')
pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')

if [ "$total" -eq 0 ]; then
    echo "WAIT: No CI checks reported yet."
    exit 1
fi

if [ "$pending" -gt 0 ]; then
    echo "WAIT: ${pending} checks still running."
    exit 1
fi

if [ "$failed" -gt 0 ]; then
    failed_names=$(echo "$checks" | jq -r '.[] | select((.state != "SUCCESS") and (.state != "IN_PROGRESS") and (.state != "QUEUED") and (.state != "PENDING") and (.state != "CANCELLED") and (.state != "SKIPPED") and (.name | startswith("codecov/") | not)) | "\(.name) (\(.state))"' | paste -sd ", ")
    echo "FAIL: ${failed} checks failed: ${failed_names}"
    exit 1
fi

echo "CI: All checks passed."

# Check AI review comments (unresolved threads from any known reviewer bot)
# shellcheck disable=SC2016
review_count=$(gh api graphql -f query="
  {
    repository(owner: \"$OWNER\", name: \"$REPO\") {
      pullRequest(number: $PR) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            comments(first: 1) {
              nodes { author { login } }
            }
          }
        }
      }
    }
  }" 2>/dev/null | jq --argjson bots "$REVIEWER_BOTS_JSON" '
  [.data.repository.pullRequest.reviewThreads.nodes[]
   | select(.isResolved == false)
   | select(.comments.nodes | length > 0)
   | .comments.nodes[0].author.login as $login
   | select($bots | any(. == $login))]
   | length') || { echo "FAIL: Could not fetch review threads (API error). Use --force to skip."; exit 1; }

if [ "$review_count" -gt 0 ] && [ "$FORCE" = "false" ]; then
    echo "BLOCK: ${review_count} unresolved AI review thread(s). Use --force to label anyway."
    exit 1
fi

if [ "$review_count" -gt 0 ]; then
    echo "WARN: ${review_count} unresolved AI review thread(s) (--force used)."
else
    echo "Review: 0 unresolved threads."
fi

# Label
if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: Would label PR #${PR} as ready-for-review"
else
    gh pr edit "$PR" --add-label "ready-for-review" >/dev/null 2>&1 || { echo "FAIL: Could not add ready-for-review label."; exit 1; }
    echo "Labeled PR #${PR} as ready-for-review."
fi

# Cleanup worktree
if [ "$CLEANUP" = "true" ]; then
    branch_dir=$(echo "$branch" | tr '/' '-')
    worktree_path="/home/froeht/Code/pinpoint-worktrees/${branch_dir}"
    # Fallback to old nested path
    if [ ! -d "$worktree_path" ]; then
        worktree_path="/home/froeht/Code/pinpoint-worktrees/${branch}"
    fi
    if [ -d "$worktree_path" ]; then
        if [ "$DRY_RUN" = "true" ]; then
            echo "DRY RUN: Would remove worktree at ${worktree_path}"
        else
            echo "Removing worktree: ${worktree_path}"
            if [ -x "./pinpoint-wt.py" ]; then
                ./pinpoint-wt.py remove "$branch" || echo "WARN: pinpoint-wt.py remove failed."
            fi
            if [ -d "$worktree_path" ]; then
                git worktree remove "$worktree_path" 2>/dev/null || \
                    echo "WARN: Could not remove worktree (it may contain uncommitted changes). Clean up manually."
            fi
        fi
    else
        echo "No worktree found at ${worktree_path}."
    fi
fi

echo "Done."
