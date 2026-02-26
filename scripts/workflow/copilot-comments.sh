#!/bin/bash
# scripts/workflow/copilot-comments.sh
# Fetches and formats UNRESOLVED Copilot review comments for one or more PRs.
# Output is ready to paste into agent prompts.
#
# Also reports review status: whether Copilot has reviewed the latest push.
# If the last commit is newer than the last Copilot review, shows "pending".
#
# Uses GraphQL to distinguish resolved vs unresolved threads, so only
# actionable comments are shown. Resolved threads are hidden.
#
# Usage:
#   ./scripts/workflow/copilot-comments.sh 918              # Single PR (always shows review status)
#   ./scripts/workflow/copilot-comments.sh 918 920 925      # Multiple PRs
#   ./scripts/workflow/copilot-comments.sh 918 --raw        # JSON output
#   ./scripts/workflow/copilot-comments.sh 918 920 --all    # Include resolved threads

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/workflow/_review-config.sh
source "$SCRIPT_DIR/_review-config.sh"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [PR_NUMBER...] [--raw|--all]"
    exit 1
fi

# Parse arguments: collect PR numbers and flags
PRS=()
MODE=""

for arg in "$@"; do
    case "$arg" in
        --raw|--all)
            if [ -n "$MODE" ]; then
                echo "Error: only one mode flag allowed (--raw or --all)."
                exit 1
            fi
            MODE="$arg"
            ;;
        *)
            if ! [[ "$arg" =~ ^[0-9]+$ ]]; then
                echo "Error: PR number must be numeric (e.g. '945'); received '$arg'."
                exit 1
            fi
            PRS+=("$arg")
            ;;
    esac
done

if [ ${#PRS[@]} -eq 0 ]; then
    echo "Error: at least one PR number is required."
    echo "Usage: $0 <PR_NUMBER> [PR_NUMBER...] [--raw|--all]"
    exit 1
fi

INCLUDE_RESOLVED=false
if [ "$MODE" = "--all" ]; then
    INCLUDE_RESOLVED=true
fi

# Function to check review status for a single PR
# Outputs: "pending" or "current"
get_review_status() {
    local PR=$1

    # Get the latest AI review timestamp (any known reviewer bot)
    latest_review=$(gh api "repos/$OWNER/$REPO/pulls/$PR/reviews" 2>/dev/null \
        | jq -r --argjson bots "$REVIEWER_BOTS_JSON" \
        '[.[] | select(.user.login as $l | $bots | any(. == $l))] | sort_by(.submitted_at) | last | .submitted_at // empty')

    if [ -z "$latest_review" ]; then
        echo "pending"
        return
    fi

    # Get the HEAD commit's committer date for this PR
    head_sha=$(gh api "repos/$OWNER/$REPO/pulls/$PR" --jq '.head.sha // empty')
    if [ -z "$head_sha" ]; then
        echo "pending"
        return
    fi
    head_date=$(gh api "repos/$OWNER/$REPO/commits/$head_sha" --jq '.commit.committer.date // empty')

    if [ -z "$head_date" ]; then
        # Unknown state: conservatively report pending rather than silently claiming current
        echo "pending"
        return
    fi

    # ISO 8601 timestamps are lexicographically sortable when both use UTC (Z suffix).
    # Both GitHub API responses use this format, so string comparison is correct here.
    # Compare: if commit is newer than last review → pending
    if [[ "$head_date" > "$latest_review" ]]; then
        echo "pending"
    else
        echo "current"
    fi
}

# Function to fetch and display comments for a single PR
fetch_pr_comments() {
    local PR=$1

    # Check review status and show header
    review_status=$(get_review_status "$PR")

    # Fetch all review threads via GraphQL
    threads_json=$(gh api graphql -f query="
    {
      repository(owner: \"$OWNER\", name: \"$REPO\") {
        pullRequest(number: $PR) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              comments(first: 1) {
                nodes {
                  author { login }
                  body
                  path
                  line
                }
              }
            }
          }
        }
      }
    }")

    # Extract AI review comments (any known reviewer bot)
    comments=$(echo "$threads_json" | jq --argjson includeResolved "$INCLUDE_RESOLVED" --argjson bots "$REVIEWER_BOTS_JSON" '
      [.data.repository.pullRequest.reviewThreads.nodes[]
       | select($includeResolved or (.isResolved == false))
       | select(.comments.nodes | length > 0)
       | .comments.nodes[0] as $comment
       | select($comment.author.login as $login | $bots | any(. == $login))
       | {
           path: $comment.path,
           line: $comment.line,
           body: $comment.body,
           resolved: .isResolved
         }]')

    count=$(echo "$comments" | jq 'length')

    if [ "$MODE" = "--raw" ]; then
        echo "$comments" | jq -c --argjson pr "$PR" --arg review_status "$review_status" --argjson unresolved_count "$count" '
          {
            pr: $pr,
            review_status: $review_status,
            unresolved_count: $unresolved_count,
            comments: [ .[] | . + { pr: $pr, review_status: $review_status } ]
          }'
        return
    fi

    # Show review status header
    if [ "$review_status" = "pending" ]; then
        echo "⏳ ${REVIEWER_LABEL} pending on PR #${PR} (last push is newer than last review)."
        echo ""
    fi

    if [ "$count" -eq 0 ]; then
        if [ "$MODE" = "--all" ]; then
            echo "No ${REVIEWER_LABEL} comments on PR #${PR}."
        else
            if [ "$review_status" = "current" ]; then
                echo "No unresolved ${REVIEWER_LABEL} comments on PR #${PR}. Review is current."
            else
                echo "No unresolved ${REVIEWER_LABEL} comments on PR #${PR} yet."
            fi
        fi
        return
    fi

    label="unresolved "
    if [ "$MODE" = "--all" ]; then
        label=""
    fi

    echo "## ${REVIEWER_LABEL} Comments on PR #${PR} (${count} ${label}comments)"
    echo ""
    echo "> NOTE: These comments were generated by an AI code reviewer, which may lack full"
    echo "> context of the problem being solved. Evaluate critically — not all suggestions"
    echo "> warrant changes. Reply with justification when ignoring a comment."
    echo ""

    echo "$comments" | jq -r '.[] | "### \(.path):\(.line // "N/A")\n\(.body)\n\n---\n"'
}

# Process each PR
for i in "${!PRS[@]}"; do
    pr="${PRS[$i]}"

    # Add separator between PRs when processing multiple
    if [ ${#PRS[@]} -gt 1 ] && [ "$i" -gt 0 ] && [ "$MODE" != "--raw" ]; then
        echo ""
        echo "================================================================"
        echo ""
    fi

    fetch_pr_comments "$pr"
done
