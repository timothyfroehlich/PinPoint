#!/bin/bash
# scripts/pr-dashboard.sh
# Shows all open PRs with CI status, Copilot comment count, and readiness.
#
# Usage:
#   ./scripts/pr-dashboard.sh          # All open PRs
#   ./scripts/pr-dashboard.sh 918 920  # Specific PRs only

set -euo pipefail

REPO="timothyfroehlich/PinPoint"

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
printf "%-6s %-40s %-12s %-10s %-8s %s\n" "PR" "Title" "CI" "Copilot" "Draft" "Branch"
printf "%-6s %-40s %-12s %-10s %-8s %s\n" "------" "----------------------------------------" "------------" "----------" "--------" "-------------------"

for pr in $PRS; do
    # Get PR metadata
    pr_data=$(gh pr view "$pr" --json title,headRefName,isDraft 2>/dev/null) || continue
    title=$(echo "$pr_data" | jq -r '.title' | cut -c1-40)
    branch=$(echo "$pr_data" | jq -r '.headRefName')
    is_draft=$(echo "$pr_data" | jq -r '.isDraft')

    # CI status: count states
    checks=$(gh pr checks "$pr" --json name,state 2>/dev/null) || checks="[]"
    total=$(echo "$checks" | jq 'length')
    passed=$(echo "$checks" | jq '[.[] | select(.state == "SUCCESS")] | length')
    failed=$(echo "$checks" | jq '[.[] | select(.state == "FAILURE")] | length')
    pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')

    if [ "$failed" -gt 0 ]; then
        ci_status="${failed} FAILED"
    elif [ "$pending" -gt 0 ]; then
        ci_status="${passed}/${total} running"
    else
        ci_status="All passed"
    fi

    # Copilot comments
    copilot_count=$(gh api "repos/${REPO}/pulls/${pr}/comments" --jq '[.[] | select(.user.login == "Copilot")] | length' 2>/dev/null) || copilot_count="?"

    # Draft status
    draft_str=""
    if [ "$is_draft" = "true" ]; then
        draft_str="draft"
    fi

    printf "%-6s %-40s %-12s %-10s %-8s %s\n" "#${pr}" "$title" "$ci_status" "$copilot_count" "$draft_str" "$branch"
done
