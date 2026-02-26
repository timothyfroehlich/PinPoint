#!/bin/bash
# scripts/workflow/resolve-copilot-threads.sh
# Resolve Copilot review threads that have been addressed by subsequent commits.
#
# A thread is considered "addressed" if the last commit on the PR is newer
# than the Copilot review that created the thread.
#
# Usage:
#   ./scripts/workflow/resolve-copilot-threads.sh <PR>              # Resolve addressed threads
#   ./scripts/workflow/resolve-copilot-threads.sh <PR> --dry-run    # Preview without resolving
#   ./scripts/workflow/resolve-copilot-threads.sh <PR> --all        # Resolve ALL unresolved Copilot threads

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/workflow/_review-config.sh
source "$SCRIPT_DIR/_review-config.sh"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [--dry-run|--all]"
    exit 1
fi

PR=$1
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be numeric (e.g. '945'); received '$PR'."
    exit 1
fi
MODE="${2:-}"

case "$MODE" in
    ""|"--dry-run"|"--all") ;;
    *) echo "Error: unknown mode '$MODE'."; echo "Usage: $0 <PR_NUMBER> [--dry-run|--all]"; exit 1 ;;
esac

# Get unresolved Copilot review threads
threads_json=$(gh api graphql -f query="
{
  repository(owner: \"$OWNER\", name: \"$REPO\") {
    pullRequest(number: $PR) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              author { login }
              body
              path
              line
              createdAt
            }
          }
        }
      }
    }
  }
}")

# Filter to unresolved AI review threads (any known reviewer bot)
unresolved=$(echo "$threads_json" | jq -r --argjson bots "$REVIEWER_BOTS_JSON" '
  [.data.repository.pullRequest.reviewThreads.nodes[]
   | select(.isResolved == false)
   | select(.comments.nodes | length > 0)
   | .comments.nodes[0] as $comment
   | select($comment.author.login as $login | $bots | any(. == $login))
   | {
       id: .id,
       path: $comment.path,
       line: $comment.line,
       body: ($comment.body | split("\n")[0] | .[0:80]),
       createdAt: $comment.createdAt
     }]')

count=$(echo "$unresolved" | jq 'length')

if [ "$count" -eq 0 ]; then
    echo "No unresolved review threads on PR #${PR}."
    exit 0
fi

echo "Found $count unresolved review thread(s) on PR #${PR}:"
echo ""

# If not --all, check timestamps to find addressed threads
if [ "$MODE" != "--all" ]; then
    # Get last commit date on the PR (used as per-thread cutoff)
    last_commit_date=$(gh pr view "$PR" --json commits --jq '.commits[-1].committedDate')

    echo "Last commit: $last_commit_date"
    echo ""

    # Filter to only threads older than the last commit (per-thread check)
    unresolved=$(echo "$unresolved" | jq --arg cutoff "$last_commit_date" '
      [.[] | select(.createdAt < $cutoff)]')
    count=$(echo "$unresolved" | jq 'length')

    if [ "$count" -eq 0 ]; then
        echo "All threads are newer than the last commit — nothing to resolve."
        echo "Use --all to resolve regardless."
        exit 0
    fi

    echo "$count thread(s) predate the last commit and are likely addressed."
    echo ""
fi

# Show and resolve each thread
echo "$unresolved" | jq -c '.[]' | while read -r thread; do
    thread_id=$(echo "$thread" | jq -r '.id')
    path=$(echo "$thread" | jq -r '.path')
    line=$(echo "$thread" | jq -r '.line')
    body=$(echo "$thread" | jq -r '.body')

    display_line="${line}"
    if [ "$display_line" = "null" ]; then
        display_line="N/A"
    fi

    echo "  ${path}:${display_line} — ${body}..."

    if [ "$MODE" = "--dry-run" ]; then
        echo "    → Would resolve (dry-run)"
    else
        gh api graphql -f query="
        mutation {
          resolveReviewThread(input: {threadId: \"$thread_id\"}) {
            thread { isResolved }
          }
        }" --silent || { echo "    → FAILED to resolve"; continue; }
        echo "    → Resolved ✓"
    fi
done

echo ""
echo "Done. $count thread(s) processed."
