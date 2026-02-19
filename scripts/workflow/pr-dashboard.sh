#!/bin/bash
# scripts/workflow/pr-dashboard.sh
# Shows all open PRs with CI status, Copilot comment count, and readiness.
#
# Usage:
#   ./scripts/workflow/pr-dashboard.sh          # All open PRs
#   ./scripts/workflow/pr-dashboard.sh 918 920  # Specific PRs only

set -euo pipefail

# Get PR list
if [ $# -gt 0 ]; then
    PRS="$*"
else
    PRS=$(gh pr list --state open --json number --jq '.[].number' | sort -n)
fi

if [ -z "$PRS" ]; then
    echo "No open PRs found."
    exit 0
fi

# Header
printf "%-6s %-40s %-12s %-10s %-10s %-8s %s\n" "PR" "Title" "CI" "Copilot" "Merge" "Draft" "Branch"
printf "%-6s %-40s %-12s %-10s %-10s %-8s %s\n" "------" "----------------------------------------" "------------" "----------" "----------" "--------" "-------------------"

for pr in $PRS; do
    if ! [[ "$pr" =~ ^[0-9]+$ ]]; then
        echo "Error: PR number must be numeric (e.g. '945'); received '$pr'."
        exit 1
    fi

    # Get PR metadata (including merge status)
    pr_data=$(gh pr view "$pr" --json title,headRefName,isDraft,mergeable,mergeStateStatus 2>/dev/null) || continue
    title=$(echo "$pr_data" | jq -r '.title' | cut -c1-40)
    branch=$(echo "$pr_data" | jq -r '.headRefName')
    is_draft=$(echo "$pr_data" | jq -r '.isDraft')
    merge_state=$(echo "$pr_data" | jq -r '.mergeStateStatus')

    # CI status: count states
    checks=$(gh pr checks "$pr" --json name,state 2>/dev/null) || checks="[]"
    total=$(echo "$checks" | jq 'length')
    passed=$(echo "$checks" | jq '[.[] | select(.state == "SUCCESS")] | length')
    failed=$(echo "$checks" | jq '[.[] | select(.state == "FAILURE" and (.name | startswith("codecov/") | not))] | length')
    pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')

    if [ "$failed" -gt 0 ]; then
        ci_status="${failed} FAILED"
    elif [ "$pending" -gt 0 ]; then
        ci_status="${passed}/${total} running"
    else
        ci_status="All passed"
    fi

    # Copilot comments (unresolved threads only)
    # shellcheck disable=SC2016
    copilot_count=$(gh api graphql -f query="
      {
        repository(owner: \"timothyfroehlich\", name: \"PinPoint\") {
          pullRequest(number: $pr) {
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
       | select(.comments.nodes | length > 0)
       | .comments.nodes[0] as $comment
       | select(
           $comment.author.login == "copilot-pull-request-reviewer"
           or $comment.author.login == "copilot-pull-request-reviewer[bot]"
         )]
       | length' 2>/dev/null) || copilot_count="?"

    # Merge status
    case "$merge_state" in
        CONFLICTING) merge_str="CONFLICT" ;;
        CLEAN)       merge_str="CLEAN" ;;
        BLOCKED)     merge_str="BLOCKED" ;;
        UNSTABLE)    merge_str="UNSTABLE" ;;
        BEHIND)      merge_str="BEHIND" ;;
        UNKNOWN)     merge_str="UNKNOWN" ;;
        *)           merge_str="${merge_state:-?}" ;;
    esac

    # Draft status
    draft_str=""
    if [ "$is_draft" = "true" ]; then
        draft_str="draft"
    fi

    printf "%-6s %-40s %-12s %-10s %-10s %-8s %s\n" "#${pr}" "$title" "$ci_status" "$copilot_count" "$merge_str" "$draft_str" "$branch"
done
