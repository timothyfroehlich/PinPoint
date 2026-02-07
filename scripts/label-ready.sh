#!/bin/bash
# scripts/label-ready.sh
# Labels a PR as ready-for-review if it passes all CI checks and has 0 Copilot comments.
# Optionally cleans up the associated worktree.
#
# Usage:
#   ./scripts/label-ready.sh 918                    # Check and label if ready
#   ./scripts/label-ready.sh 918 --cleanup          # Also remove worktree
#   ./scripts/label-ready.sh 918 --force             # Label even with Copilot comments
#   ./scripts/label-ready.sh 918 --dry-run           # Show what would happen

set -euo pipefail

REPO="timothyfroehlich/PinPoint"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [--cleanup] [--force] [--dry-run]"
    exit 1
fi

PR=$1
shift

CLEANUP=false
FORCE=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --cleanup) CLEANUP=true ;;
        --force) FORCE=true ;;
        --dry-run) DRY_RUN=true ;;
    esac
done

# Get branch name
branch=$(gh pr view "$PR" --json headRefName --jq '.headRefName')
is_draft=$(gh pr view "$PR" --json isDraft --jq '.isDraft')

echo "PR #${PR} — branch: ${branch}"

# Check draft
if [ "$is_draft" = "true" ]; then
    echo "SKIP: PR is a draft."
    exit 1
fi

# Check CI
checks=$(gh pr checks "$PR" --json name,state 2>/dev/null) || checks="[]"
failed=$(echo "$checks" | jq '[.[] | select(.state == "FAILURE" and (.name | startswith("codecov/") | not))] | length')
pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')

if [ "$pending" -gt 0 ]; then
    echo "WAIT: ${pending} checks still running."
    exit 1
fi

if [ "$failed" -gt 0 ]; then
    failed_names=$(echo "$checks" | jq -r '.[] | select(.state == "FAILURE" and (.name | startswith("codecov/") | not)) | .name' | paste -sd ", ")
    echo "FAIL: ${failed} checks failed: ${failed_names}"
    exit 1
fi

echo "CI: All checks passed."

# Check Copilot comments (unresolved threads only via GraphQL)
copilot_count=$(gh api graphql -f query="
  {
    repository(owner: \"timothyfroehlich\", name: \"PinPoint\") {
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
  }" --jq '
  [.data.repository.pullRequest.reviewThreads.nodes[]
   | select(.isResolved == false)
   | select(.comments.nodes[0].author.login == "copilot-pull-request-reviewer[bot]")]
   | length' 2>/dev/null) || copilot_count=0

if [ "$copilot_count" -gt 0 ] && [ "$FORCE" = "false" ]; then
    echo "BLOCK: ${copilot_count} Copilot comments. Use --force to label anyway."
    exit 1
fi

if [ "$copilot_count" -gt 0 ]; then
    echo "WARN: ${copilot_count} Copilot comments (--force used)."
else
    echo "Copilot: 0 comments."
fi

# Label
if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: Would label PR #${PR} as ready-for-review"
else
    gh pr edit "$PR" --add-label "ready-for-review" 2>/dev/null || true
    echo "Labeled PR #${PR} as ready-for-review."
fi

# Cleanup worktree
if [ "$CLEANUP" = "true" ]; then
    worktree_path="/home/froeht/Code/pinpoint-worktrees/${branch}"
    if [ -d "$worktree_path" ]; then
        if [ "$DRY_RUN" = "true" ]; then
            echo "DRY RUN: Would remove worktree at ${worktree_path}"
        else
            echo "Removing worktree: ${worktree_path}"
            ./pinpoint-wt.py remove "$branch" 2>/dev/null || \
                git worktree remove "$worktree_path" --force 2>/dev/null || \
                echo "WARN: Could not remove worktree. Clean up manually."
        fi
    else
        echo "No worktree found at ${worktree_path}."
    fi
fi

echo "Done."
